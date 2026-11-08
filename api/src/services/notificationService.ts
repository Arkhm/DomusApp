import { HttpError } from '../lib/httpError';
import { userRepository } from '../repositories/userRepository';
import { noticeRepository } from '../repositories/noticeRepository';
import { eventRepository } from '../repositories/eventRepository';
import { notificationRepository, type NotificationType } from '../repositories/notificationRepository';

async function activeUser(userId: string) {
  const user = await userRepository.findById(userId);
  if (!user || user.status !== 'ACTIVE') throw new HttpError(401, 'Sessão inválida.');
  return user;
}

export const notificationService = {
  async list(userId: string) {
    const user = await activeUser(userId);
    // A central pessoal respeita os destinatários também para síndicos.
    const [notices, events, reads] = await Promise.all([
      noticeRepository.findForUser(userId, user.unitId),
      eventRepository.findForUser(user.unitId),
      notificationRepository.findReads(userId),
    ]);
    const readEvents = new Set(reads.map(read => read.sourceId));
    const items = [
      ...notices.map(notice => ({
        id: `NOTICE:${notice.id}`, type: 'NOTICE' as const, sourceId: notice.id,
        title: notice.title, description: 'Novo comunicado', createdAt: notice.createdAt,
        // NoticeRead é a referência: a edição do comunicado invalida suas leituras.
        isRead: notice.readBy.length > 0,
      })),
      ...events.map(event => ({
        id: `EVENT:${event.id}`, type: 'EVENT' as const, sourceId: event.id,
        title: event.title, description: event.status === 'CANCELLED' ? 'Evento cancelado' : 'Evento publicado',
        createdAt: event.createdAt, isRead: readEvents.has(event.id),
      })),
    ];
    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id));
  },

  async markRead(userId: string, type: NotificationType, sourceId: string) {
    const user = await activeUser(userId);
    await notificationRepository.markRead(userId, type, sourceId, user.unitId);
    return { message: 'Notificação lida.' };
  },
};
