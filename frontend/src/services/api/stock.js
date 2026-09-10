import { http } from '@/services/apiClient';

export const stockApi = {
  /** Goods received. Runs inside a locked transaction server-side. */
  async stockIn(payload) {
    const { data, message } = await http.post('/stock/in', payload);
    return { movement: data, message };
  },

  /** Goods issued. Rejected with 409 when the requested quantity is short. */
  async stockOut(payload) {
    const { data, message } = await http.post('/stock/out', payload);
    return { movement: data, message };
  },

  /** Controlled correction: records before, delta, after and a reason. */
  async adjust(payload) {
    const { data, message } = await http.post('/stock/adjust', payload);
    return { adjustment: data, message };
  },
};
