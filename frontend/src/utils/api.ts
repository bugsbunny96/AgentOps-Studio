import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Always include /api/v1 suffix so callers use short paths like /auth/me
const BASE_URL = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,              // Send HTTP-Only cookies automatically
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// ─── Request Interceptor ────────────────────────────────────────────────────
// Injects the active organization ID header on every request
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  try {
    const stored = localStorage.getItem('activeOrgId');
    if (stored) {
      config.headers['X-Organization-ID'] = stored;
    }
  } catch {
    // localStorage unavailable (SSR / private mode) — skip silently
  }
  return config;
});

// ─── Response Interceptor ───────────────────────────────────────────────────
// Handles 401 refresh-token flow and 403 redirects globally
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Auto-refresh on 401 (access token expired) — only once per request
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        await axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true });
        return api(original); // retry original request with refreshed cookie
      } catch {
        // Refresh failed — fall through and reject.
        // React components (verifySession catch, login catch) will handle redirect
        // via React Router — no window.location to avoid reload loops.
      }
    }

    // 403 ONBOARDING_INCOMPLETE — let React Router handle, not window.location
    if (error.response?.status === 403) {
      const data = error.response.data as { code?: string };
      if (data?.code === 'ONBOARDING_INCOMPLETE') {
        window.location.href = '/onboarding'; // intentional hard redirect (rare case)
      }
    }

    return Promise.reject(error);
  }
);

export default api;
