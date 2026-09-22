import api from './axios';

export const authApi = {
  login: async (email, password) => {
    const response = await api.post('/api/auth/login/', { email, password });
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/api/auth/me/');
    return response.data;
  },

  updateMe: async (userData) => {
    const response = await api.patch('/api/auth/me/', userData);
    return response.data;
  },

  logout: async (refreshToken) => {
    try {
      await api.post('/api/auth/logout/', { refresh: refreshToken });
    } catch {
      // Graceful logout even if network fails
    }
  },

  changePassword: async (passwordData) => {
    const response = await api.post('/api/auth/change-password/', passwordData);
    return response.data;
  },

  forgotPassword: async (email) => {
    const response = await api.post('/api/auth/forgot-password/', { email });
    return response.data;
  },

  resetPassword: async (resetData) => {
    const response = await api.post('/api/auth/reset-password/', resetData);
    return response.data;
  },
};
