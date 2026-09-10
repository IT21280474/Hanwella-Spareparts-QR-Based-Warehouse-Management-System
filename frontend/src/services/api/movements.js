import { http, cleanParams } from '@/services/apiClient';

export const movementsApi = {
  async list(params = {}) {
    const { data, meta } = await http.get('/movements', { params: cleanParams(params) });
    return { rows: data ?? [], meta };
  },
};
