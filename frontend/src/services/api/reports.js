import { http, cleanParams } from '@/services/apiClient';
import { API_URL } from '@/constants';

/** Report keys accepted by the API. */
export const REPORT_TYPES = {
  SALES: 'sales',
  INVENTORY: 'inventory',
  PAYMENTS: 'payments',
  LOW_STOCK: 'low-stock',
  OUT_OF_STOCK: 'out-of-stock',
  STOCK_IN: 'stock-in',
  STOCK_OUT: 'stock-out',
  USER_ACTIVITY: 'user-activity',
};

export const reportsApi = {
  async get(type, params = {}) {
    const { data, meta } = await http.get(`/reports/${type}`, { params: cleanParams(params) });
    return { report: data, meta };
  },

  /**
   * Export runs as a normal browser navigation so the file is streamed by the
   * server rather than assembled in memory in the browser.
   */
  exportUrl(type, params = {}) {
    const query = new URLSearchParams({ ...cleanParams(params), format: 'csv' });
    return `${API_URL}/api/v1/reports/${type}/export?${query.toString()}`;
  },
};
