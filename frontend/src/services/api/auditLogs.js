import { http, cleanParams } from '@/services/apiClient';

export const auditLogsApi = {
  async list(params = {}) {
    const { data, meta } = await http.get('/audit-logs', { params: cleanParams(params) });
    return { rows: data ?? [], meta };
  },
};
