import api from './axios';

export const customerApi = {
  getCustomers: async (params = {}) => {
    const response = await api.get('/api/customers/', { params });
    return response.data;
  },

  getCustomerById: async (id) => {
    const response = await api.get(`/api/customers/${id}/`);
    return response.data;
  },

  updateCustomer: async (id, data) => {
    const response = await api.patch(`/api/customers/${id}/`, data);
    return response.data;
  },
};
