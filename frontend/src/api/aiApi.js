import api from './axios';

export const aiApi = {
  /**
   * Send a chat message to CRM AI Assistant
   */
  sendMessage: async (prompt, context = {}, conversation_history = []) => {
    const response = await api.post('/api/ai/chat/', {
      prompt,
      context,
      conversation_history,
    });
    return response.data;
  },

  /**
   * Execute a user-confirmed CRM write action
   */
  executeAction: async (actionPayload) => {
    const response = await api.post('/api/ai/execute-action/', {
      action_payload: actionPayload,
    });
    return response.data;
  },

  /**
   * Request Real AI Audio Transcription and Structured Deal Summary
   */
  generateCallSummary: async (payload) => {
    const config = payload instanceof FormData ? {
      headers: { 'Content-Type': 'multipart/form-data' },
    } : {};
    const response = await api.post('/api/ai/call-summary/', payload, config);
    return response.data;
  },

  /**
   * Calls CRUD (for saved calls)
   */
  getCalls: async (params = {}) => {
    const response = await api.get('/api/calls/', { params });
    return response.data;
  },

  getCallById: async (id) => {
    const response = await api.get(`/api/calls/${id}/`);
    return response.data;
  },

  createCall: async (callData) => {
    const isFormData = callData instanceof FormData;
    const config = isFormData ? {
      headers: { 'Content-Type': 'multipart/form-data' },
    } : {};
    const response = await api.post('/api/calls/', callData, config);
    return response.data;
  },

  updateCallTranscript: async (callId, transcript, reanalyze = false) => {
    const response = await api.post(`/api/calls/${callId}/transcript/`, {
      transcript,
      reanalyze,
    });
    return response.data;
  },

  retryCallAnalysis: async (callId) => {
    const response = await api.post(`/api/calls/${callId}/retry/`);
    return response.data;
  },

  getLeadCalls: async (leadId) => {
    const response = await api.get(`/api/leads/${leadId}/calls/`);
    return response.data;
  },
};
