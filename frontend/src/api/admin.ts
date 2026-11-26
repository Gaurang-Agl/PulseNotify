import { apiClient } from './client';
import { AdminSummaryResponse } from '../types';

export async function getAdminSummaryApi(): Promise<AdminSummaryResponse> {
  const response = await apiClient.get<AdminSummaryResponse>('/api/admin/summary/');
  return response.data;
}

export interface ClearDataResult {
  message: string;
  cleared: {
    alerts: number;
    notifications: number;
    quota_logs: number;
    quota_counter_reset: boolean;
    redis_flushed: boolean;
  };
}

export async function clearAllPlatformDataApi(): Promise<ClearDataResult> {
  const response = await apiClient.post<ClearDataResult>('/api/admin/clear-data/');
  return response.data;
}
