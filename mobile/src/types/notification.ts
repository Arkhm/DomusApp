export type NotificationType = 'NOTICE' | 'EVENT' | 'INCIDENT' | 'INVOICE' | 'RESERVATION' | 'VOTING';

export interface AppNotification {
  id: string;
  eventId?: string;
  type: NotificationType;
  sourceId: string;
  title: string;
  description: string;
  createdAt: string;
  isRead: boolean;
}
