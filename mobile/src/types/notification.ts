export type NotificationType = 'NOTICE' | 'EVENT' | 'INCIDENT';

export interface AppNotification {
  id: string;
  type: NotificationType;
  sourceId: string;
  title: string;
  description: string;
  createdAt: string;
  isRead: boolean;
}
