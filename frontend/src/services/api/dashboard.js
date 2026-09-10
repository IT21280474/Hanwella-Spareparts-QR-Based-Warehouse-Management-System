import { http } from '@/services/apiClient';

export const dashboardApi = {
  async summary() {
    const { data } = await http.get('/dashboard');
    return data;
  },
};
