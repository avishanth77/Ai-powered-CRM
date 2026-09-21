import api from './axios';

export const userApi = {
  getUsers: async (params = {}) => {
    const response = await api.get('/api/users/', { params });
    return response.data;
  },

  createUser: async (userData) => {
    const response = await api.post('/api/users/', userData);
    return response.data;
  },

  updateUser: async (id, userData) => {
    const response = await api.patch(`/api/users/${id}/`, userData);
    return response.data;
  },

  deleteUser: async (id) => {
    const response = await api.delete(`/api/users/${id}/`);
    return response.data;
  },
};
