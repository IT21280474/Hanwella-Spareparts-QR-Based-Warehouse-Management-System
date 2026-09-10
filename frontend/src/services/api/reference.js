import { http, cleanParams } from '@/services/apiClient';

/**
 * Reference data — categories, suppliers, warehouses and locations.
 *
 * These share one CRUD shape, so they share one factory rather than four
 * near-identical modules.
 */
function resource(path) {
  return {
    async list(params = {}) {
      const { data, meta } = await http.get(path, { params: cleanParams(params) });
      return { rows: data ?? [], meta };
    },
    async get(id) {
      const { data } = await http.get(`${path}/${id}`);
      return data;
    },
    async create(payload) {
      const { data, message } = await http.post(path, payload);
      return { row: data, message };
    },
    async update(id, payload) {
      const { data, message } = await http.put(`${path}/${id}`, payload);
      return { row: data, message };
    },
    async remove(id) {
      const { message } = await http.delete(`${path}/${id}`);
      return message;
    },
  };
}

export const categoriesApi = resource('/categories');
export const suppliersApi = resource('/suppliers');
export const warehousesApi = resource('/warehouses');
export const locationsApi = resource('/locations');
