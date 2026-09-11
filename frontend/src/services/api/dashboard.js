import { http } from '@/services/apiClient';

export const dashboardApi = {
  async summary() {
    const { data } = await http.get('/dashboard');
    return data;
  },

  /** Security's own overview — orders ready to release, and recent dispatch activity. */
  async security() {
    const { data } = await http.get('/dashboard/security');
    return data;
  },
};
