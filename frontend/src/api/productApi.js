import api from './axios';

export const productApi = {
  // Products Catalog
  getProducts: async (params = {}) => {
    const res = await api.get('/api/products/', { params });
    return res.data;
  },

  getSimpleProducts: async () => {
    const res = await api.get('/api/products/simple/');
    return res.data?.data || res.data || [];
  },

  getProduct: async (id) => {
    const res = await api.get(`/api/products/${id}/`);
    return res.data;
  },

  createProduct: async (data) => {
    const res = await api.post('/api/products/', data);
    return res.data;
  },

  updateProduct: async (id, data) => {
    const res = await api.patch(`/api/products/${id}/`, data);
    return res.data;
  },

  deleteProduct: async (id) => {
    const res = await api.delete(`/api/products/${id}/`);
    return res.data;
  },

  getProductStats: async () => {
    const res = await api.get('/api/products/stats/');
    return res.data?.data || res.data;
  },

  // Lead Products (Line Items)
  getLeadProducts: async (leadId) => {
    const res = await api.get('/api/products/lead-products/', { params: { lead: leadId } });
    return res.data?.results || res.data || [];
  },

  addLeadProduct: async (data) => {
    const res = await api.post('/api/products/lead-products/', data);
    return res.data;
  },

  updateLeadProduct: async (id, data) => {
    const res = await api.patch(`/api/products/lead-products/${id}/`, data);
    return res.data;
  },

  removeLeadProduct: async (id) => {
    const res = await api.delete(`/api/products/lead-products/${id}/`);
    return res.data;
  },
};
export default productApi;