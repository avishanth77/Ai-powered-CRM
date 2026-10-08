import api from './axios';

const asList = (response) => response?.results ?? (Array.isArray(response) ? response : []);

export const pldApi = {
  // Problem management (Admin / Manager for writes)
  getProblems: async (params = {}) => {
    const response = await api.get('/api/pld/problems/', { params });
    return response.data;
  },
  createProblem: async (payload) => {
    const response = await api.post('/api/pld/problems/', payload);
    return response.data;
  },
  updateProblem: async (id, payload) => {
    const response = await api.put(`/api/pld/problems/${id}/`, payload);
    return response.data;
  },
  deleteProblem: async (id) => {
    const response = await api.delete(`/api/pld/problems/${id}/`);
    return response.data;
  },
  toggleProblemActive: async (id, isActive) => {
    const response = await api.patch(`/api/pld/problems/${id}/toggle-active/`, { is_active: isActive });
    return response.data;
  },
  moveProblem: async (id, direction) => {
    const response = await api.patch(`/api/pld/problems/${id}/move/`, { direction });
    return response.data;
  },

  // Scoring threshold
  getScoringConfig: async () => {
    const response = await api.get('/api/pld/config/');
    return response.data;
  },
  updateScoringConfig: async (payload) => {
    const response = await api.put('/api/pld/config/', payload);
    return response.data;
  },

  // Stage gates
  getGates: async () => {
    const response = await api.get('/api/pld/gates/');
    return response.data;
  },
  createGate: async (payload) => {
    const response = await api.post('/api/pld/gates/', payload);
    return response.data;
  },
  updateGate: async (id, payload) => {
    const response = await api.patch(`/api/pld/gates/${id}/`, payload);
    return response.data;
  },
  deleteGate: async (id) => {
    const response = await api.delete(`/api/pld/gates/${id}/`);
    return response.data;
  },

  // Lead scoped assessment + history + gates
  getLeadPld: async (leadId, params = {}) => {
    const queryParams = typeof params === 'object' ? params : { stage: params };
    const response = await api.get(`/api/leads/${leadId}/pld/`, { params: queryParams });
    return response.data;
  },
  submitAssessment: async (leadId, problemIds, stageId = null) => {
    const payload = { problem_ids: problemIds };
    if (stageId) payload.stage_id = stageId;
    const response = await api.post(`/api/leads/${leadId}/pld/assess/`, payload);
    return response.data;
  },
  getAssessmentHistory: async (leadId, params = {}) => {
    const queryParams = typeof params === 'object' ? params : { stage: params };
    const response = await api.get(`/api/leads/${leadId}/pld/history/`, { params: queryParams });
    return { ...response.data, results: asList(response.data) };
  },
  getAssessment: async (assessmentId) => {
    const response = await api.get(`/api/pld/assessments/${assessmentId}/`);
    return response.data;
  },
  checkGate: async (leadId, stageId) => {
    const response = await api.get(`/api/leads/${leadId}/pld/gate-check/`, { params: { stage: stageId } });
    return response.data;
  },
};
