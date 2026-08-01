import axios from "axios";

export const SESSION_KEY = "tv_digital_admin_session";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
  timeout: 15000
});

api.interceptors.request.use((config) => {
  const raw = localStorage.getItem(SESSION_KEY);
  if (raw) {
    try {
      const session = JSON.parse(raw);
      if (session.token) config.headers.Authorization = `Bearer ${session.token}`;
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !String(error.config?.url || "").includes("/auth/login")
    ) {
      localStorage.removeItem(SESSION_KEY);
      window.dispatchEvent(new Event("tv-digital-session-expired"));
    }
    return Promise.reject(error);
  }
);

export const apiError = (error, fallback = "No se pudo completar la acción") =>
  error.response?.data?.message || error.message || fallback;

export default api;
