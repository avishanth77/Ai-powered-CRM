import api from './axios';

export const targetApi = {
  /**
   * List staff targets and progress.
   * Admin/Manager sees all staff; Executive sees their own.
   */
  getTargets: async (params = {}) => {
    const response = await api.get('/api/targets/', { params });
    return response.data;
  },

  /**
   * Get active target and live daily/monthly progress for the current logged-in user,
   * or a specific staff member if user_id is provided by an Admin.
   */
  getCurrentTarget: async (params = {}) => {
    const response = await api.get('/api/targets/current/', { params });
    return response.data;
  },

  /**
   * Get team-wide target summary, aggregate progress, and leaderboard (Admin/Manager).
   */
  getTeamOverview: async (params = {}) => {
    const response = await api.get('/api/targets/overview/', { params });
    return response.data;
  },

  /**
   * Get recommended standard target presets.
   */
  getPresets: async () => {
    const response = await api.get('/api/targets/presets/');
    return response.data;
  },

  /**
   * Create or customize target for a staff member (Admin/Manager).
   * Upserts for (user, period_month).
   */
  saveTarget: async (targetData) => {
    const response = await api.post('/api/targets/', targetData);
    return response.data;
  },

  /**
   * Update target by ID.
   */
  updateTarget: async (id, targetData) => {
    const response = await api.patch(`/api/targets/${id}/`, targetData);
    return response.data;
  },

  /**
   * Delete target.
   */
  deleteTarget: async (id) => {
    const response = await api.delete(`/api/targets/${id}/`);
    return response.data;
  },
};
