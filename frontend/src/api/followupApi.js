import api from './axios';

export const followupApi = {
  getFollowUps: async (params = {}) => {
    const response = await api.get('/api/follow-ups/', { params });
    return response.data;
  },

  createFollowUp: async (data) => {
    const response = await api.post('/api/follow-ups/', data);
    return response.data;
  },

  updateFollowUp: async (id, data) => {
    const response = await api.patch(`/api/follow-ups/${id}/`, data);
    return response.data;
  },

  completeFollowUp: async (id, outcomeData) => {
    const response = await api.post(`/api/follow-ups/${id}/complete/`, outcomeData);
    return response.data;
  },

  getOverdue: async () => {
    const response = await api.get('/api/follow-ups/overdue/');
    return response.data;
  },

  getToday: async () => {
    const response = await api.get('/api/follow-ups/today/');
    return response.data;
  },

  deleteFollowUp: async (id) => {
    const response = await api.delete(`/api/follow-ups/${id}/`);
    return response.data;
  },
};
