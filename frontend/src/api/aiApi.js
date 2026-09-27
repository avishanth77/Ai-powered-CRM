import api from './axios';
import { getMockChatResponse, MOCK_STRUCTURED_SUMMARY, MOCK_TRANSCRIPT_CONVERSATION } from '../services/mockAiService';

export const aiApi = {
  /**
   * Send a chat message to CRM AI Assistant
   */
  sendMessage: async (prompt, context = {}) => {
    try {
      const response = await api.post('/api/ai/chat/', { prompt, context });
      return response.data;
    } catch {
      // Graceful fallback to client-side mock intelligence service
      const mockResult = await getMockChatResponse(prompt, context);
      return {
        success: true,
        data: {
          response: mockResult.text,
          intent: mockResult.intent,
          suggestions: mockResult.suggestions,
        },
      };
    }
  },

  /**
   * Request AI Call Transcription and Structured Summary
   */
  generateCallSummary: async (payload) => {
    try {
      // payload can be FormData (for audio file) or JSON (for notes)
      const config = payload instanceof FormData ? {
        headers: { 'Content-Type': 'multipart/form-data' },
      } : {};
      const response = await api.post('/api/ai/call-summary/', payload, config);
      return response.data;
    } catch {
      // Simulated processing delay if backend endpoint isn't reached
      await new Promise((resolve) => setTimeout(resolve, 800));
      return {
        success: true,
        data: {
          transcript: MOCK_TRANSCRIPT_CONVERSATION,
          summary: MOCK_STRUCTURED_SUMMARY,
        },
      };
    }
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

  getLeadCalls: async (leadId) => {
    const response = await api.get(`/api/leads/${leadId}/calls/`);
    return response.data;
  },
};
