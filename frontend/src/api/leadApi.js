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

  importLeads: async (file, options = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    if (options.columnMapping) {
      formData.append(
        'column_mapping',
        typeof options.columnMapping === 'string'
          ? options.columnMapping
          : JSON.stringify(options.columnMapping)
      );
    }
    if (options.defaultStage) formData.append('default_stage', options.defaultStage);
    if (options.defaultPriority) formData.append('default_priority', options.defaultPriority);
    if (options.defaultSource) formData.append('default_source', options.defaultSource);

    const response = await api.post('/api/leads/import/', formData, {
      // Let the browser set the multipart boundary for FormData
      transformRequest: [
        (data, headers) => {
          if (headers && typeof headers.delete === 'function') {
            headers.delete('Content-Type');
          } else if (headers) {
            delete headers['Content-Type'];
          }
          return data;
        },
      ],
    });
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

  getPipeline: async (params = {}) => {
    const response = await api.get('/api/leads/pipeline/', { params });
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

  getWinProbabilityFunnel: async () => {
    const response = await api.get('/api/lead-stages/funnel/');
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

  // Automated Stage Task Rules APIs
  getStageTaskRules: async (params = {}) => {
    const response = await api.get('/api/stage-task-rules/', { params });
    return response.data;
  },

  getStageTaskRuleById: async (id) => {
    const response = await api.get(`/api/stage-task-rules/${id}/`);
    return response.data;
  },

  createStageTaskRule: async (ruleData) => {
    const response = await api.post('/api/stage-task-rules/', ruleData);
    return response.data;
  },

  updateStageTaskRule: async (id, ruleData) => {
    const response = await api.patch(`/api/stage-task-rules/${id}/`, ruleData);
    return response.data;
  },

  deleteStageTaskRule: async (id) => {
    const response = await api.delete(`/api/stage-task-rules/${id}/`);
    return response.data;
  },

  toggleStageTaskRuleActive: async (id) => {
    const response = await api.patch(`/api/stage-task-rules/${id}/toggle-active/`);
    return response.data;
  },

  getStageTaskRulesByStage: async () => {
    const response = await api.get('/api/stage-task-rules/by-stage/');
    return response.data;
  },

  // Task-Based Progression & Lead Stage Tasks
  getLeadStageTasks: async (leadId, params = {}) => {
    const response = await api.get(`/api/leads/${leadId}/stage-tasks/`, { params });
    return response.data;
  },

  createLeadStageTask: async (leadId, taskData) => {
    const response = await api.post(`/api/leads/${leadId}/stage-tasks/`, taskData);
    return response.data;
  },

  updateLeadStageTask: async (taskId, taskData) => {
    const response = await api.patch(`/api/leads/stage-tasks/${taskId}/`, taskData);
    return response.data;
  },

  deleteLeadStageTask: async (taskId) => {
    const response = await api.delete(`/api/leads/stage-tasks/${taskId}/`);
    return response.data;
  },

  toggleCompleteStageTask: async (taskId, outcomeNotes = '') => {
    const response = await api.post(`/api/leads/stage-tasks/${taskId}/toggle-complete/`, { outcome_notes: outcomeNotes });
    return response.data;
  },

  reassignStageTask: async (taskId, assignedToUserId) => {
    const response = await api.post(`/api/leads/stage-tasks/${taskId}/reassign/`, { assigned_to: assignedToUserId });
    return response.data;
  },

  getProgressionStatus: async (leadId, targetStageId = null) => {
    const params = targetStageId ? { target_stage: targetStageId } : {};
    const response = await api.get(`/api/leads/${leadId}/progression-status/`, { params });
    return response.data;
  },

  getManagerStageTasksOverview: async (params = {}) => {
    const response = await api.get('/api/leads/stage-tasks/manager-overview/', { params });
    return response.data;
  },

  submitWebToLead: async (formData) => {
    const response = await api.post('/api/leads/web-to-lead/', formData);
    return response.data;
  },

  // Dynamic Custom Properties
  getCustomProperties: async (params = {}) => {
    const response = await api.get('/api/leads/custom-properties/', { params });
    return response.data;
  },

  createCustomProperty: async (propertyData) => {
    const response = await api.post('/api/leads/custom-properties/', propertyData);
    return response.data;
  },

  updateCustomProperty: async (id, propertyData) => {
    const response = await api.patch(`/api/leads/custom-properties/${id}/`, propertyData);
    return response.data;
  },

  deleteCustomProperty: async (id) => {
    const response = await api.delete(`/api/leads/custom-properties/${id}/`);
    return response.data;
  },

  reorderCustomProperties: async (orderList) => {
    const response = await api.post('/api/leads/custom-properties/reorder/', { order: orderList });
    return response.data;
  },

  updateLeadCustomProperties: async (leadId, properties) => {
    const response = await api.post(`/api/leads/${leadId}/custom-properties/`, { properties });
    return response.data;
  },

  // Auto-Assignment & Routing Rules
  getAssignmentConfig: async () => {
    const response = await api.get('/api/leads/assignment-config/');
    return response.data;
  },

  updateAssignmentConfig: async (configData) => {
    const response = await api.patch('/api/leads/assignment-config/', configData);
    return response.data;
  },

  getAssignmentRules: async (params = {}) => {
    const response = await api.get('/api/leads/assignment-rules/', { params });
    return response.data;
  },

  createAssignmentRule: async (ruleData) => {
    const response = await api.post('/api/leads/assignment-rules/', ruleData);
    return response.data;
  },

  updateAssignmentRule: async (id, ruleData) => {
    const response = await api.patch(`/api/leads/assignment-rules/${id}/`, ruleData);
    return response.data;
  },

  deleteAssignmentRule: async (id) => {
    const response = await api.delete(`/api/leads/assignment-rules/${id}/`);
    return response.data;
  },

  reorderAssignmentRules: async (orderList) => {
    const response = await api.post('/api/leads/assignment-rules/reorder/', { order: orderList });
    return response.data;
  },

  autoAssignLead: async (leadId) => {
    const response = await api.post(`/api/leads/${leadId}/auto-assign/`);
    return response.data;
  },
};
