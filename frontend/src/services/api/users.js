import { http, cleanParams } from '@/services/apiClient';

export const usersApi = {
  async list(params = {}) {
    const { data, meta } = await http.get('/users', { params: cleanParams(params) });
    return { rows: data ?? [], meta };
  },

  async get(id) {
    const { data } = await http.get(`/users/${id}`);
    return data;
  },

  async create(payload) {
    const { data, message } = await http.post('/users', payload);
    return { user: data, message };
  },

  async update(id, payload) {
    const { data, message } = await http.put(`/users/${id}`, payload);
    return { user: data, message };
  },

  /** Deactivation is preferred over deletion — history must stay intact. */
  async setActive(id, isActive) {
    const { data, message } = await http.patch(`/users/${id}/status`, { is_active: isActive });
    return { user: data, message };
  },

  async roles() {
    const { data } = await http.get('/roles');
    return data ?? [];
  },
};
