import api from './api';

const deviceService = {
  getAll: (params = {}) => api.get('/devices', { params }),
  getById: (id) => api.get(`/devices/${id}`),
  create: (data) => api.post('/devices', data),
  update: (id, data) => api.put(`/devices/${id}`, data),
  delete: (id) => api.delete(`/devices/${id}`),
  toggleStatus: (id, status) => api.patch(`/devices/${id}/status`, { status }),
  powerOff: (id) => api.post(`/devices/${id}/power-off`),
  powerOn: (id) => api.post(`/devices/${id}/power-on`),
  powerToggle: (id, action) => api.patch(`/devices/${id}/power`, { action }),  // 'on' or 'off'

  getStats: () => api.get('/devices/stats/overview'),
};

export default deviceService;
