import { http } from '@/services/apiClient';
import { API_URL } from '@/constants';

export const importsApi = {
  /** Upload a spreadsheet for validation. Nothing is written until confirm. */
  async upload(file, onProgress) {
    const body = new FormData();
    body.append('file', file);

    const { data, message } = await http.post('/imports', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      },
    });

    return { batch: data, message };
  },

  async get(batchId) {
    const { data } = await http.get(`/imports/${batchId}`);
    return data;
  },

  /** Commit the validated rows. */
  async confirm(batchId) {
    const { data, message } = await http.post(`/imports/${batchId}/confirm`);
    return { batch: data, message };
  },

  /** One .zip, one photo per part, matched by filename against part number or SKU. */
  async uploadPhotos(zipFile) {
    const body = new FormData();
    body.append('file', zipFile);

    const { data, message } = await http.post('/imports/photos', body, {
      headers: { 'Content-Type': undefined },
      timeout: 120_000,
    });

    return { result: data, message };
  },

  templateUrl: () => `${API_URL}/api/v1/imports/template`,
  errorReportUrl: (batchId) => `${API_URL}/api/v1/imports/${batchId}/errors`,
};
