import { http, cleanParams } from '@/services/apiClient';

/**
 * The yard gate. Every eligibility decision is made by the server: nothing
 * here sends a payment status, and the dispatch call carries only a note.
 */
export const securityApi = {
  async dashboard() {
    const { data } = await http.get('/security/dashboard');
    return data;
  },

  /** Fully paid, not cancelled, not yet dispatched — as the server defines it. */
  async yardStock(params = {}) {
    const { data, meta } = await http.get('/security/yard-stock', { params: cleanParams(params) });
    return { rows: data ?? [], meta };
  },

  /**
   * Exact lookup by order number. Resolves with `{ order, eligible, reason }`
   * for an order in (or released from) the yard; rejects with a 404 for an
   * unknown number and a 409 for one that is unpaid or cancelled.
   */
  async searchOrder(orderNo) {
    const { data, meta, message } = await http.get('/security/orders/search', { params: { order_no: orderNo } });
    return { order: data, eligible: !!meta?.eligible, reason: meta?.reason ?? null, message };
  },

  async getOrder(id) {
    const { data } = await http.get(`/security/orders/${id}`);
    return data;
  },

  async dispatch(id, payload = {}) {
    const { data, message } = await http.post(`/security/orders/${id}/dispatch`, { notes: payload.notes || null });
    return { dispatch: data?.dispatch, order: data?.order, message };
  },

  async dispatchHistory(params = {}) {
    const { data, meta } = await http.get('/security/dispatch-history', { params: cleanParams(params) });
    return { rows: data ?? [], meta };
  },
};
