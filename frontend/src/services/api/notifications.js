import { http, cleanParams } from '@/services/apiClient';

/** A signed-in user's own alert inbox — low stock, orders ready for dispatch, and so on. */
export const notificationsApi = {
  async list(params = {}) {
    const { data, meta } = await http.get('/notifications', { params: cleanParams(params) });
    return { rows: data ?? [], meta };
  },

  async read(id) {
    const { data, message } = await http.post(`/notifications/${id}/read`);
    return { notification: data, message };
  },

  async readAll() {
    const { message } = await http.post('/notifications/read-all');
    return message;
  },
};
