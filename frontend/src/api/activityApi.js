import api from './axios';

export const activityApi = {
  getActivities: async (params = {}) => {
    const response = await api.get('/api/activity/', { params });
    return response.data;
  },
};
