/** Currency symbol shown beside every monetary amount. */
export const CURRENCY = import.meta.env.VITE_CURRENCY || 'Rs';

/** Base URL of the Laravel API host, without a trailing slash. */
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

/** Company block printed on customer bills; the API overrides these at runtime. */
export const COMPANY_FALLBACK = {
  name: 'Hanwella Spareparts Warehouse',
  address: '',
  contact: '',
  registration_no: '',
};

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/** Debounce applied to every server-side search box, in milliseconds. */
export const SEARCH_DEBOUNCE_MS = 350;

/** Toast lifetime, matching the reference. */
export const TOAST_TTL_MS = 3600;
