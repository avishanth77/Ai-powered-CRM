import api from './axios';

const asList = (response) => response?.results ?? (Array.isArray(response) ? response : []);

export const icpApi = {
  // Question management (Admin / Manager for writes)
  getQuestions: async (params = {}) => {
    const response = await api.get('/api/icp/questions/', { params });
    return response.data;
  },
  getQuestion: async (id) => {
    const response = await api.get(`/api/icp/questions/${id}/`);
    return response.data;
  },
  createQuestion: async (payload) => {
    const response = await api.post('/api/icp/questions/', payload);
    return response.data;
  },
  updateQuestion: async (id, payload) => {
    const response = await api.put(`/api/icp/questions/${id}/`, payload);
    return response.data;
  },
  deleteQuestion: async (id) => {
    const response = await api.delete(`/api/icp/questions/${id}/`);
    return response.data;
  },
  toggleQuestionActive: async (id, isActive) => {
    const response = await api.patch(`/api/icp/questions/${id}/toggle-active/`, { is_active: isActive });
    return response.data;
  },
  moveQuestion: async (id, direction) => {
    const response = await api.patch(`/api/icp/questions/${id}/move/`, { direction });
    return response.data;
  },

  // Scoring thresholds
  getScoringConfig: async () => {
    const response = await api.get('/api/icp/config/');
    return response.data;
  },
  updateScoringConfig: async (payload) => {
    const response = await api.put('/api/icp/config/', payload);
    return response.data;
  },

  // Lead scoped test + history
  getLeadIcp: async (leadId) => {
    const response = await api.get(`/api/leads/${leadId}/icp/`);
    return response.data;
  },
  submitQualification: async (leadId, answers) => {
    const response = await api.post(`/api/leads/${leadId}/icp/qualify/`, { answers });
    return response.data;
  },
  getQualificationHistory: async (leadId) => {
    const response = await api.get(`/api/leads/${leadId}/icp/history/`);
    return { ...response.data, results: asList(response.data) };
  },
  getQualification: async (qualificationId) => {
    const response = await api.get(`/api/icp/qualifications/${qualificationId}/`);
    return response.data;
  },
};