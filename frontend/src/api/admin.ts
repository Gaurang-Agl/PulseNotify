import { apiClient } from './client';
import { AdminSummaryResponse } from '../types';

export async function getAdminSummaryApi(): Promise<AdminSummaryResponse> {
  const response = await apiClient.get<AdminSummaryResponse>('/api/admin/summary/');
  return response.data;
}
