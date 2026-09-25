import api from './axios';

export const calendarApi = {
  getEvents: async (params = {}) => {
    const response = await api.get('/api/calendar/events/', { params });
    return response.data;
  },

  scheduleEvent: async (eventData) => {
    const response = await api.post('/api/follow-ups/', eventData);
    return response.data;
  },

  updateEvent: async (id, eventData) => {
    const response = await api.patch(`/api/follow-ups/${id}/`, eventData);
    return response.data;
  },

  completeEvent: async (id, outcomeData) => {
    const response = await api.post(`/api/follow-ups/${id}/complete/`, outcomeData);
    return response.data;
  },

  cancelEvent: async (id) => {
    const response = await api.patch(`/api/follow-ups/${id}/`, { status: 'CANCELLED' });
    return response.data;
  },
};
