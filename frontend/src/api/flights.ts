import { apiClient } from './client';
import { FlightPriceResponse } from '../types';

export const SUPPORTED_ROUTES = ['DEL-BOM', 'BLR-HYD', 'DEL-BLR', 'BOM-GOA'] as const;

export const ROUTE_AIRPORTS: Record<string, { originName: string; destName: string; min: number; max: number }> = {
  'DEL-BOM': { originName: 'Delhi (DEL)', destName: 'Mumbai (BOM)', min: 3000, max: 7000 },
  'BLR-HYD': { originName: 'Bengaluru (BLR)', destName: 'Hyderabad (HYD)', min: 1500, max: 4000 },
  'DEL-BLR': { originName: 'Delhi (DEL)', destName: 'Bengaluru (BLR)', min: 4000, max: 9000 },
  'BOM-GOA': { originName: 'Mumbai (BOM)', destName: 'Goa (GOA)', min: 2000, max: 5000 },
};

export async function getFlightPriceApi(route: string, forceRefresh: boolean = false): Promise<FlightPriceResponse> {
  const params: Record<string, string> = { route };
  if (forceRefresh) {
    params.refresh = 'true';
  }
  const response = await apiClient.get<FlightPriceResponse>('/api/flights/price/', {
    params,
  });
  return response.data;
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await getFlightPriceApi('DEL-BOM');
    return !!res.route;
  } catch {
    return false;
  }
}
