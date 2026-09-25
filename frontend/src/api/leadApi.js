import api from './axios';

export const leadApi = {
  getLeads: async (params = {}) => {
    const response = await api.get('/api/leads/', { params });
    return response.data;
  },

  getLeadById: async (id) => {
    const response = await api.get(`/api/leads/${id}/`);
    return response.data;
  },

  createLead: async (leadData) => {
    const response = await api.post('/api/leads/', leadData);
    return response.data;
  },

  updateLead: async (id, leadData) => {
    const response = await api.patch(`/api/leads/${id}/`, leadData);
    return response.data;
  },

  deleteLead: async (id) => {
    const response = await api.delete(`/api/leads/${id}/`);
    return response.data;
  },

  convertLead: async (id) => {
    const response = await api.post(`/api/leads/${id}/convert/`);
    return response.data;
  },

  assignLead: async (id, assignedToId) => {
    const response = await api.post(`/api/leads/${id}/assign/`, { assigned_to: assignedToId });
    return response.data;
  },

  handoverLead: async (id, data) => {
    const response = await api.post(`/api/leads/${id}/handover/`, data);
    return response.data;
  },

  bulkHandover: async (data) => {
    const response = await api.post('/api/leads/bulk-handover/', data);
    return response.data;
  },

  getLeadHandovers: async (id) => {
    const response = await api.get(`/api/leads/${id}/handovers/`);
    return response.data;
  },

  getNotes: async (leadId) => {
    const response = await api.get(`/api/leads/${leadId}/notes/`);
    return response.data;
  },

  addNote: async (leadId, noteData) => {
    const response = await api.post(`/api/leads/${leadId}/notes/`, noteData);
    return response.data;
  },

  getTimeline: async (leadId) => {
    const response = await api.get(`/api/leads/${leadId}/timeline/`);
    return response.data;
  },

  getPipeline: async () => {
    const response = await api.get('/api/leads/pipeline/');
    return response.data;
  },

  // Dynamic Lead Stages APIs
  getStages: async (params = {}) => {
    const response = await api.get('/api/lead-stages/', { params });
    return response.data;
  },

  createStage: async (stageData) => {
    const response = await api.post('/api/lead-stages/', stageData);
    return response.data;
  },

  updateStage: async (id, stageData) => {
    const response = await api.patch(`/api/lead-stages/${id}/`, stageData);
    return response.data;
  },

  deleteStage: async (id, data = {}) => {
    const response = await api.delete(`/api/lead-stages/${id}/`, { data });
    return response.data;
  },

  toggleStageActive: async (id, data = {}) => {
    const response = await api.patch(`/api/lead-stages/${id}/toggle-active/`, data);
    return response.data;
  },

  moveStage: async (id, data) => {
    const response = await api.patch(`/api/lead-stages/${id}/move/`, data);
    return response.data;
  },

  getStageStats: async (id) => {
    const response = await api.get(`/api/lead-stages/${id}/stats/`);
    return response.data;
  },

  getSources: async () => {
    const response = await api.get('/api/leads/sources/');
    return response.data;
  },

  createSource: async (sourceData) => {
    const response = await api.post('/api/leads/sources/', sourceData);
    return response.data;
  },

  updateSource: async (id, sourceData) => {
    const response = await api.patch(`/api/leads/sources/${id}/`, sourceData);
    return response.data;
  },

  getAiSummary: async (id) => {
    const response = await api.get(`/api/leads/${id}/ai_summary/`);
    return response.data;
  },
};
