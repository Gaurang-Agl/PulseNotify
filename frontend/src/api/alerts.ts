import { apiClient } from './client';
import { PriceAlert, PriceAlertCreate } from '../types';

export async function listAlertsApi(statusFilter?: string): Promise<PriceAlert[]> {
  const params: Record<string, string> = {};
  if (statusFilter && statusFilter !== 'all') {
    params.status = statusFilter;
  }
  const response = await apiClient.get<PriceAlert[]>('/api/alerts/', { params });
  return response.data;
}

export async function getAlertDetailApi(id: number): Promise<PriceAlert> {
  const response = await apiClient.get<PriceAlert>(`/api/alerts/${id}/`);
  return response.data;
}

export async function createAlertApi(data: PriceAlertCreate): Promise<PriceAlert> {
  const response = await apiClient.post<PriceAlert>('/api/alerts/', data);
  return response.data;
}

export async function deactivateAlertApi(id: number): Promise<{ status: string }> {
  const response = await apiClient.delete<{ status: string }>(`/api/alerts/${id}/`);
  return response.data;
}
