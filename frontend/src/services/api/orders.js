import { http, cleanParams } from '@/services/apiClient';

export const ordersApi = {
  async list(params = {}) {
    const { data, meta } = await http.get('/orders', { params: cleanParams(params) });
    return { rows: data ?? [], meta };
  },

  async get(id) {
    const { data } = await http.get(`/orders/${id}`);
    return data;
  },

  /** Finalise a counter sale: deducts stock and writes movements atomically. */
  async create(payload) {
    const { data, message } = await http.post('/orders', payload);
    return { order: data, message };
  },

  async updatePayment(id, payload) {
    const { data, message } = await http.patch(`/orders/${id}/payment`, payload);
    return { order: data, message };
  },

  /** Cancelling returns the sold units to stock as compensating movements. */
  async cancel(id, payload = {}) {
    const { data, message } = await http.post(`/orders/${id}/cancel`, payload);
    return { order: data, message };
  },

  /** Security's checkpoint: confirms a fully paid order's goods left. Does not move stock — that already happened at payment time. */
  async dispatch(id) {
    const { data, message } = await http.post(`/orders/${id}/dispatch`);
    return { order: data, message };
  },
};
