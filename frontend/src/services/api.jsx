// frontend/src/services/api.jsx
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar el token automáticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============================================================
// API DE TIENDA
// ============================================================
export const storeAPI = {
  getOrder: (orderNumber) => api.get(`/store/order/${orderNumber}`),
  createWarranty: (data) => api.post('/store/warranties', data),
  getMyWarranties: () => api.get('/store/warranties'),
  getWarrantyDetail: (id) => api.get(`/store/warranties/${id}`),
};

// ============================================================
// API DE ADMIN (NUEVO - FASE 9)
// ============================================================
export const adminAPI = {
  // Laboratorios
  getLabs: () => api.get('/admin/labs'),
  createLab: (data) => api.post('/admin/labs', data),
  updateLab: (id, data) => api.put(`/admin/labs/${id}`, data),
  deleteLab: (id) => api.delete(`/admin/labs/${id}`),
  regenerateLabApiKey: (id) => api.post(`/admin/labs/${id}/regenerate-key`),

  // Tiendas
  getStores: () => api.get('/admin/stores'),
  createStore: (data) => api.post('/admin/stores', data),
  updateStore: (id, data) => api.put(`/admin/stores/${id}`, data),

  // Usuarios
  resetUserPassword: (userId, newPassword) =>
    api.post(`/admin/users/${userId}/reset-password`, { newPassword }),

  // Dashboard de Garantías
  getWarrantiesDashboard: (params) => api.get('/admin/warranties', { params }),

  // Logs
  getLogs: (params) => api.get('/admin/logs', { params }),

  // Importar CSV
  importCsv: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/admin/import-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export default api;