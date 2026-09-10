import { http, cleanParams } from '@/services/apiClient';

export const inventoryApi = {
  /** Paginated inventory rows: a part joined with its on-hand position. */
  async list(params = {}) {
    const { data, meta } = await http.get('/inventory', { params: cleanParams(params) });
    return { rows: data ?? [], meta };
  },

  async get(partId) {
    const { data } = await http.get(`/inventory/${partId}`);
    return data;
  },

  async transfer(payload) {
    const { data, message } = await http.post('/inventory/transfer', payload);
    return { movement: data, message };
  },
};
