import { http, cleanParams } from '@/services/apiClient';

export const qrApi = {
  /** Issue QR identities for parts that do not yet hold one. */
  async generate(payload) {
    const { data, message } = await http.post('/qr/generate', payload);
    return { codes: data ?? [], message };
  },

  /**
   * Resolve a scanned code to a part. The code is validated server-side —
   * a value read off a camera is never trusted as an identifier.
   */
  async scan(code) {
    const { data, message } = await http.post('/qr/scan', { code });
    return { part: data, message };
  },

  async get(code) {
    const { data } = await http.get(`/qr/${encodeURIComponent(code)}`);
    return data;
  },

  /** Label payloads for a print run: from sequence, count and layout. */
  async labels(params) {
    const { data, meta } = await http.get('/qr/labels', { params: cleanParams(params) });
    return { labels: data ?? [], meta };
  },

  /** Record that a batch reached the printer, for the print_count audit trail. */
  async markPrinted(codes) {
    const { message } = await http.post('/qr/labels/printed', { codes });
    return message;
  },
};
