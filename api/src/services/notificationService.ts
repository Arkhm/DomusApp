import { userRepository } from '../repositories/userRepository';
import { noticeRepository } from '../repositories/noticeRepository';
import { eventRepository } from '../repositories/eventRepository';
import { notificationRepository } from '../repositories/notificationRepository';

export class NotificationError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export const notificationService = {
  async list(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user || user.status !== 'ACTIVE') throw new NotificationError('Sessão inválida.', 401);
    // A central pessoal respeita destinatários mesmo quando o usuário é síndico.
    const [notices, events, reads] = await Promise.all([
      noticeRepository.findForUser(userId, user.unitId),
      eventRepository.findForUser(user.unitId),
      notificationRepository.findReads(userId),
    ]);
    const readKeys = new Set(reads.map((read) => `${read.type}:${read.sourceId}`));
    const items = [
      ...notices.map(({ readBy, ...notice }) => ({
        id: `NOTICE:${notice.id}`, type: 'NOTICE' as const, sourceId: notice.id,
        title: notice.title, description: 'Novo comunicado', createdAt: notice.createdAt,
        isRead: readKeys.has(`NOTICE:${notice.id}`),
        notice: { ...notice, isRead: readBy.length > 0 },
      })),
      ...events.map((event) => ({
        id: `EVENT:${event.id}`, type: 'EVENT' as const, sourceId: event.id,
        title: event.title, description: event.status === 'CANCELLED' ? 'Evento cancelado' : 'Evento publicado',
        createdAt: event.createdAt, isRead: readKeys.has(`EVENT:${event.id}`), event,
      })),
    ];
    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id));
  },

  async markRead(userId: string, type: string, sourceId: string) {
    const visible = await this.list(userId);
    if (!visible.some((item) => item.type === type && item.sourceId === sourceId)) {
      throw new NotificationError('Notificação não encontrada.', 404);
    }
    await notificationRepository.markRead(userId, type, sourceId);
  },
};
