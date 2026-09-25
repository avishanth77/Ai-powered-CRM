import api from './axios';

export const commentApi = {
  getLeadComments: async (leadId) => {
    const response = await api.get(`/api/leads/${leadId}/comments/`);
    return response.data;
  },

  createComment: async (leadId, commentData) => {
    const response = await api.post(`/api/leads/${leadId}/comments/`, commentData);
    return response.data;
  },

  updateComment: async (commentId, data) => {
    const response = await api.patch(`/api/comments/${commentId}/`, data);
    return response.data;
  },

  deleteComment: async (commentId) => {
    const response = await api.delete(`/api/comments/${commentId}/`);
    return response.data;
  },

  getMentionSuggestions: async (query = '') => {
    const response = await api.get('/api/users/mention-suggestions/', {
      params: { q: query }
    });
    return response.data;
  },
};
