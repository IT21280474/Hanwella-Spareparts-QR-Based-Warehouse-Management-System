import { http, ensureCsrfCookie } from '@/services/apiClient';

export const authApi = {
  /** Establish the session cookie, then return the signed-in user. */
  async login(credentials) {
    await ensureCsrfCookie();
    const { data } = await http.post('/auth/login', credentials);
    return data;
  },

  async logout() {
    await http.post('/auth/logout');
  },

  /** Resolve the current user, or throw a 401 when there is no session. */
  async me() {
    const { data } = await http.get('/auth/me');
    return data;
  },

  async forgotPassword(email) {
    const { message } = await http.post('/auth/forgot-password', { email });
    return message;
  },

  async resetPassword(payload) {
    const { message } = await http.post('/auth/reset-password', payload);
    return message;
  },
};
