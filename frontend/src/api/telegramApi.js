import api from './axios';

export const telegramApi = {
  getStatus: async () => {
    const response = await api.get('/api/telegram/status/');
    return response.data;
  },

  generateLinkCode: async () => {
    const response = await api.post('/api/telegram/generate-link-code/');
    return response.data;
  },

  updatePreferences: async (preferences) => {
    const response = await api.post('/api/telegram/preferences/', preferences);
    return response.data;
  },

  disconnect: async () => {
    const response = await api.post('/api/telegram/disconnect/');
    return response.data;
  },

  sendTestMessage: async () => {
    const response = await api.post('/api/telegram/test-message/');
    return response.data;
  },
};

