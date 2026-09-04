import axios from 'axios';

function getBaseUrl() {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url || url.includes('.internal') || url.includes('.local')) {
    return '/api/v1';
  }
  let trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = `https://${trimmed}`;
  }
  return `${trimmed}/api/v1`;
}

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to requests if present
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('volq_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Intercept 401 Unauthorized to redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('volq_token');
        localStorage.removeItem('volq_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
