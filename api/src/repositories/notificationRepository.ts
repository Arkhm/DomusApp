import type { Prisma } from '@prisma/client';
import { HttpError } from '../lib/httpError';
import { prisma } from '../lib/prisma';

export type NotificationType = 'NOTICE' | 'EVENT' | 'INCIDENT';

export const notificationRepository = {
  findReads: (userId: string) => prisma.notificationRead.findMany({
    where: { userId, type: { in: ['EVENT', 'INCIDENT'] } },
    select: { type: true, sourceId: true, readAt: true },
  }),

  markRead: (userId: string, type: NotificationType, sourceId: string, unitId: string | null) =>
    prisma.$transaction(async tx => {
      const recipients = [{ targetType: 'ALL' }, ...(unitId ? [{ targetType: 'UNIT', targetUnitId: unitId }] : [])];
      if (type === 'NOTICE') {
        // Usa o mesmo lock da edição de comunicados, que invalida NoticeRead.
        await tx.$queryRaw`SELECT id FROM Notice WHERE id = ${sourceId} FOR UPDATE`;
        const notice = await tx.notice.findFirst({
          where: { id: sourceId, status: 'PUBLISHED', OR: recipients } satisfies Prisma.NoticeWhereInput,
          select: { id: true },
        });
        if (!notice) throw new HttpError(404, 'Notificação não encontrada.');
        await tx.noticeRead.upsert({
          where: { noticeId_userId: { noticeId: sourceId, userId } },
          create: { noticeId: sourceId, userId }, update: {},
        });
      } else if (type === 'INCIDENT') {
        // Só o autor recebe a atualização da própria ocorrência.
        const incident = await tx.incident.findFirst({ where: { id: sourceId, authorId: userId }, select: { id: true } });
        if (!incident) throw new HttpError(404, 'Notificação não encontrada.');
      } else {
        await tx.$queryRaw`SELECT id FROM Event WHERE id = ${sourceId} FOR UPDATE`;
        const event = await tx.event.findFirst({
          where: { id: sourceId, status: { in: ['PUBLISHED', 'CANCELLED'] }, OR: recipients },
          select: { id: true },
        });
        if (!event) throw new HttpError(404, 'Notificação não encontrada.');
      }
      return tx.notificationRead.upsert({
        where: { userId_type_sourceId: { userId, type, sourceId } },
        // readAt avança a cada leitura: uma ocorrência alterada depois volta a ficar não lida.
        create: { userId, type, sourceId }, update: { readAt: new Date() },
      });
    }),
};
