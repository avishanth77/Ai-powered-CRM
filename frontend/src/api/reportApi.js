import api from './axios';
import { API_BASE_URL } from '../utils/constants';

export const reportApi = {
  getSummary: async () => {
    const response = await api.get('/api/reports/summary/');
    return response.data;
  },

  getPreview: async (params = {}) => {
    const response = await api.get('/api/reports/preview/', { params });
    return response.data;
  },

  getExportUrl: (params = {}) => {
    const query = new URLSearchParams({ format: 'csv', ...params }).toString();
    return `${API_BASE_URL}/api/reports/export/?${query}`;
  },

  downloadExportCsv: async (params = {}) => {
    const response = await api.get('/api/reports/export/', {
      params: { format: 'csv', ...params },
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm_lite_report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
