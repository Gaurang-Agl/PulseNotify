import { apiClient } from './client';
import { AuthResponse } from '../types';

export async function loginApi(payload: { username: string; password: string }): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/api/auth/login/', payload);
  return response.data;
}

export async function registerApi(payload: {
  username: string;
  password: string;
  email?: string;
}): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/api/auth/register/', payload);
  return response.data;
}
