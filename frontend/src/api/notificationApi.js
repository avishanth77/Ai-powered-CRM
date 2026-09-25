import api from './axios';

export const notificationApi = {
  getNotifications: async (params = {}) => {
    const response = await api.get('/api/notifications/', { params });
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await api.get('/api/notifications/unread-count/');
    return response.data;
  },

  markAsRead: async (id) => {
    const response = await api.patch(`/api/notifications/${id}/read/`);
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await api.patch('/api/notifications/mark-all-read/');
    return response.data;
  },

  deleteNotification: async (id) => {
    const response = await api.delete(`/api/notifications/${id}/`);
    return response.data;
  },
};
