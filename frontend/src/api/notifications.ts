import { apiClient } from './client';
import { NotificationLog } from '../types';

export async function listNotificationsApi(): Promise<NotificationLog[]> {
  const response = await apiClient.get<NotificationLog[]>('/api/notifications/');
  return response.data;
}
