import axios from 'axios';
import { API_URL } from '@/constants';
import { toApiError } from '@/utils/errors';

/**
 * The single configured HTTP client.
 *
 * Authentication is a Sanctum session cookie: httpOnly, sent automatically,
 * never readable by JavaScript. No token is stored in the browser, so there is
 * nothing for an XSS payload to exfiltrate.
 */
export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  withCredentials: true,
  timeout: 20_000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
});

/** Broadcast when the server rejects the session, so the auth layer can react. */
export const SESSION_EXPIRED_EVENT = 'wms:session-expired';

const MUTATING = ['post', 'put', 'patch', 'delete'];
const hasXsrfCookie = () => document.cookie.includes('XSRF-TOKEN=');

let csrfRequest = null;

/**
 * Prime the CSRF cookie. Concurrent callers share one in-flight request so a
 * page that fires several mutations at once does not stampede the endpoint.
 */
export function ensureCsrfCookie() {
  if (hasXsrfCookie()) return Promise.resolve();
  if (!csrfRequest) {
    csrfRequest = axios
      .get(`${API_URL}/sanctum/csrf-cookie`, { withCredentials: true })
      .finally(() => {
        csrfRequest = null;
      });
  }
  return csrfRequest;
}

apiClient.interceptors.request.use(async (config) => {
  if (MUTATING.includes((config.method || '').toLowerCase())) {
    await ensureCsrfCookie();
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const config = error?.config || {};

    // A stale CSRF token is recoverable exactly once: re-prime and replay.
    if (status === 419 && !config.__csrfRetried) {
      config.__csrfRetried = true;
      document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/';
      await ensureCsrfCookie();
      return apiClient(config);
    }

    // `auth/me` returning 401 is how the app discovers it is signed out; it
    // must not itself trigger a session-expired broadcast, or boot would loop.
    if (status === 401 && !config.url?.includes('auth/me') && !config.url?.includes('auth/login')) {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }

    return Promise.reject(toApiError(error));
  },
);

/** Unwrap the `{success, message, data, meta}` envelope. */
const unwrap = (response) => ({
  data: response.data?.data ?? null,
  meta: response.data?.meta ?? null,
  message: response.data?.message ?? '',
});

export const http = {
  get: (url, config) => apiClient.get(url, config).then(unwrap),
  post: (url, body, config) => apiClient.post(url, body, config).then(unwrap),
  put: (url, body, config) => apiClient.put(url, body, config).then(unwrap),
  patch: (url, body, config) => apiClient.patch(url, body, config).then(unwrap),
  delete: (url, config) => apiClient.delete(url, config).then(unwrap),
};

/** Strip empty filter values so the query string stays readable and cacheable. */
export function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== '' && value !== null && value !== undefined && value !== 'All',
    ),
  );
}
