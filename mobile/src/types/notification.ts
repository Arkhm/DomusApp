export type NotificationType = 'NOTICE' | 'EVENT';

export interface AppNotification {
  id: string;
  type: NotificationType;
  sourceId: string;
  title: string;
  description: string;
  createdAt: string;
  isRead: boolean;
}
