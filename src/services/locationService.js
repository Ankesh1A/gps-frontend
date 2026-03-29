import api from './api';

const locationService = {
  getAllLive: () => api.get('/locations/live'),
  getCurrentLocation: (deviceId) => api.get(`/locations/${deviceId}/current`),
  getHistory: (deviceId, from, to) =>
    api.get(`/locations/${deviceId}/history`, { params: { from, to } }),
  getHistoryWithStats: (deviceId, from, to) =>
    api.get(`/locations/${deviceId}/history/stats`, { params: { from, to } }),
  pushLocation: (deviceId, data) => api.post(`/locations/${deviceId}/push`, data),
  calculateDistance: (lat1, lng1, lat2, lng2) =>
    api.post('/locations/distance/calculate', { lat1, lng1, lat2, lng2 }),
  calculateRouteDistance: (waypoints) =>
    api.post('/locations/distance/route', { waypoints }),
};

export default locationService;
