import { api } from './api';
import type { AppNotification } from '../types/notification';
import type { CondoEvent, Notice } from '../types/domain';
import { listNotices } from './noticeService';
import { listEvents } from './eventService';

export type NotificationSource = Pick<AppNotification, 'type' | 'sourceId'>;
export type NotificationTarget = { type: 'NOTICE'; notice: Notice } | { type: 'EVENT'; event: CondoEvent } | { type: 'INCIDENT' };

export async function listNotifications(): Promise<AppNotification[]> {
  const { data } = await api.get<AppNotification[]>('/notifications');
  return data;
}

export async function markNotificationRead(item: NotificationSource): Promise<void> {
  await api.post(`/notifications/${item.type}/${encodeURIComponent(item.sourceId)}/read`);
}

export async function resolveNotificationTarget(item: NotificationSource, unitId: string | null): Promise<NotificationTarget> {
  const isAddressee = (record: Notice | CondoEvent) => record.targetType === 'ALL' ||
    (unitId !== null && record.targetType === 'UNIT' && record.targetUnitId === unitId);
  if (item.type === 'INCIDENT') {
    // A lista de ocorrências não tem tela de detalhe: abrir a notificação já é a leitura.
    await markNotificationRead(item);
    return { type: 'INCIDENT' };
  }
  if (item.type === 'NOTICE') {
    const notice = (await listNotices()).find(record => record.id === item.sourceId &&
      record.status === 'PUBLISHED' && isAddressee(record));
    if (notice) return { type: 'NOTICE', notice };
  } else {
    const event = (await listEvents()).find(record => record.id === item.sourceId &&
      (record.status === 'PUBLISHED' || record.status === 'CANCELLED') && isAddressee(record));
    if (event) return { type: 'EVENT', event };
  }
  throw new Error('O conteúdo desta notificação não está mais disponível.');
}
