import { http, cleanParams } from '@/services/apiClient';

// apiClient sets a default 'Content-Type: application/json' header on every
// request. For FormData we must remove it — axios/the browser then compute
// the correct 'multipart/form-data; boundary=...' automatically. Passing
// `undefined` here (not omitting the key) is what tells axios to drop the
// instance default rather than inherit it.
const MULTIPART = { headers: { 'Content-Type': undefined } };

/**
 * A part payload becomes multipart only when a photo is attached — every
 * other field keeps going through as plain JSON, unchanged from before this
 * existed, so the common (no-photo) path never pays a serialization cost or
 * risks a shape regression.
 */
function toFormData(payload) {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    if (key === 'image' && !(value instanceof File)) return;
    form.append(key, value);
  });
  return form;
}

export const partsApi = {
  async list(params = {}) {
    const { data, meta } = await http.get('/parts', { params: cleanParams(params) });
    return { rows: data ?? [], meta };
  },

  async get(id) {
    const { data } = await http.get(`/parts/${id}`);
    return data;
  },

  async create(payload) {
    const hasImage = payload.image instanceof File;
    if (!hasImage) {
      const { data, message } = await http.post('/parts', payload);
      return { part: data, message };
    }
    const { data, message } = await http.post('/parts', toFormData(payload), MULTIPART);
    return { part: data, message };
  },

  async update(id, payload) {
    const hasImage = payload.image instanceof File;
    const removingImage = payload.remove_image === true;

    if (hasImage || removingImage) {
      // PHP never parses a multipart body on PUT — Laravel's `_method`
      // spoofing sends it as POST but still routes to the PUT handler.
      const form = toFormData(payload);
      form.append('_method', 'PUT');
      const { data, message } = await http.post(`/parts/${id}`, form, MULTIPART);
      return { part: data, message };
    }

    const { data, message } = await http.put(`/parts/${id}`, payload);
    return { part: data, message };
  },

  async remove(id) {
    const { message } = await http.delete(`/parts/${id}`);
    return message;
  },

  /** Movement history for one part, newest first. */
  async movements(id, params = {}) {
    const { data, meta } = await http.get(`/parts/${id}/movements`, { params: cleanParams(params) });
    return { rows: data ?? [], meta };
  },
};
