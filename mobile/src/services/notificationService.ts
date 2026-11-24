import { api } from './api';
import type { AppNotification } from '../types/notification';
import type { CondoEvent, Notice } from '../types/domain';
import { listNotices } from './noticeService';
import { listEvents } from './eventService';

export type NotificationSource = Pick<AppNotification, 'type' | 'sourceId' | 'eventId'>;
export type NotificationTarget = { type: 'NOTICE'; notice: Notice } | { type: 'EVENT'; event: CondoEvent } | { type: 'INCIDENT' } | { type: 'INVOICE'; invoiceId: string } | { type: 'RESERVATION'; sourceId: string } | { type: 'VOTING'; sourceId: string };

export async function listNotifications(): Promise<AppNotification[]> {
  const { data } = await api.get<AppNotification[]>('/notifications');
  return data;
}

export async function markNotificationRead(item: NotificationSource): Promise<void> {
  if (item.eventId) { await api.post(`/notifications/inbox/${encodeURIComponent(item.eventId)}/read`); return; }
  await api.post(`/notifications/${item.type}/${encodeURIComponent(item.sourceId)}/read`);
}

export async function resolveNotificationTarget(item: NotificationSource, unitId: string | null): Promise<NotificationTarget> {
  const isAddressee = (record: Notice | CondoEvent) => record.targetType === 'ALL' ||
    (unitId !== null && record.targetType === 'UNIT' && record.targetUnitId === unitId);
  if (item.type === 'INVOICE' || item.type === 'RESERVATION' || item.type === 'VOTING') {
    const endpoint = item.type === 'INVOICE' ? `/invoices/${encodeURIComponent(item.sourceId)}` : item.type === 'RESERVATION' ? '/reservations' : '/votings';
    const { data } = await api.get(endpoint);
    if (item.type !== 'INVOICE' && !data.some((r: { id: string }) => r.id === item.sourceId)) throw new Error('Conteúdo indisponível.');
    await markNotificationRead(item);
    if (item.type === 'INVOICE') return { type: 'INVOICE', invoiceId: item.sourceId };
    return { type: item.type, sourceId: item.sourceId };
  }
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
