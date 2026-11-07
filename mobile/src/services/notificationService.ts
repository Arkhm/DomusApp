import { api } from './api';
import type { AppNotification } from '../types/notification';

export async function listNotifications(): Promise<AppNotification[]> {
  const { data } = await api.get<AppNotification[]>('/notifications');
  return data;
}

export async function markNotificationRead(item: AppNotification): Promise<void> {
  await api.post(`/notifications/${item.type}/${encodeURIComponent(item.sourceId)}/read`);
}
