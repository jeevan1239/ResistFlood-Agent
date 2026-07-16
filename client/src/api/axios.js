import axios from 'axios';

/**
 * Shared axios instance.
 * Attaches the JWT from localStorage to every request automatically.
 * Base URL falls back to the Vite dev-server proxy ('/api') so no env var
 * is needed during development.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rf_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
