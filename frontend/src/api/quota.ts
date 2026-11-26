import { apiClient } from './client';
import { QuotaTelemetry, QuotaSimulationResponse } from '../types';

export const getQuotaTelemetryApi = async (): Promise<QuotaTelemetry> => {
  const response = await apiClient.get<QuotaTelemetry>('/api/admin/quota/');
  return response.data;
};

export const resetQuotaApi = async (): Promise<{ status: string; used_calls: number; monthly_limit: number }> => {
  const response = await apiClient.post('/api/admin/quota/');
  return response.data;
};

export interface QuotaSimulatePayload {
  target_percentage?: number;
  call_count?: number;
  route?: string;
  provider?: string;
}

export const simulateQuotaApi = async (payload: QuotaSimulatePayload): Promise<QuotaSimulationResponse> => {
  const response = await apiClient.post<QuotaSimulationResponse>('/api/admin/quota/simulate/', payload);
  return response.data;
};
