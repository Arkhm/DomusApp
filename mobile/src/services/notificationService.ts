import { api } from './api';
import type { CondoEvent, Notice } from '../types';

type NotificationBase = {
  id: string;
  sourceId: string;
  title: string;
  description: string;
  createdAt: string;
  isRead: boolean;
};
export type AppNotification = NotificationBase & (
  | { type: 'NOTICE'; notice: Notice }
  | { type: 'EVENT'; event: CondoEvent }
);

export async function listNotifications(): Promise<AppNotification[]> {
  const { data } = await api.get<AppNotification[]>('/notifications');
  return data;
}

export async function markNotificationRead(item: AppNotification): Promise<void> {
  await api.post(`/notifications/${item.type}/${item.sourceId}/read`);
}
