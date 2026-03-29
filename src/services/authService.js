import api from './api';

const authService = {
  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.token) {
      localStorage.setItem('gps_token', res.data.token);
      localStorage.setItem('gps_user', JSON.stringify(res.data.user));
    }
    return res.data;
  },
  register: async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    if (res.data.token) {
      localStorage.setItem('gps_token', res.data.token);
      localStorage.setItem('gps_user', JSON.stringify(res.data.user));
    }
    return res.data;
  },
  getMe: () => api.get('/auth/me'),
  logout: () => {
    localStorage.removeItem('gps_token');
    localStorage.removeItem('gps_user');
  },
  isLoggedIn: () => !!localStorage.getItem('gps_token'),
  getUser: () => {
    const u = localStorage.getItem('gps_user');
    return u ? JSON.parse(u) : null;
  },
};

export default authService;
