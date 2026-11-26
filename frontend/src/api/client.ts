import axios, { AxiosError } from 'axios';
import { ApiErrorResponse } from '../types';

export const apiClient = axios.create({
  baseURL: '', // Uses Vite reverse proxy to forward /api requests to http://127.0.0.1:8000
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Bearer token from localStorage on every request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('pulsenotify_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auto-handle 401 Unauthorized / Token Expiration
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      const data = error.response.data as { detail?: string; code?: string };
      if (
        data?.code === 'token_not_valid' ||
        data?.detail?.includes('token not valid') ||
        data?.detail?.includes('Authentication credentials were not provided')
      ) {
        localStorage.removeItem('pulsenotify_token');
        localStorage.removeItem('pulsenotify_user');
        window.dispatchEvent(new Event('pulsenotify:auth_expired'));
      }
    }
    return Promise.reject(error);
  }
);

export function parseApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    const data = axiosError.response?.data;

    if (data && typeof data === 'object') {
      if (typeof data.error === 'string') {
        return data.error;
      }
      if (typeof data.detail === 'string') {
        if (data.detail.toLowerCase().includes('token not valid')) {
          return 'Your session has expired. Please sign in again.';
        }
        return data.detail;
      }
      if (Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) {
        return String(data.non_field_errors[0]);
      }
      // Check field-level errors
      const dict = data as Record<string, unknown>;
      for (const key of Object.keys(dict)) {
        const val = dict[key];
        if (Array.isArray(val) && val.length > 0) {
          return `${key.replace('_', ' ')}: ${val[0]}`;
        }
        if (typeof val === 'string') {
          return val;
        }
      }
    }
    if (axiosError.message) {
      return axiosError.message;
    }
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}
