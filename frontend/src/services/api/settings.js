import { http } from '@/services/apiClient';

export const settingsApi = {
  async get() {
    const { data } = await http.get('/settings');
    return data;
  },

  async update(payload) {
    const { data, message } = await http.put('/settings', payload);
    return { settings: data, message };
  },
};
