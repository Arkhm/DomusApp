import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
export const inboxRepository = {
  snapshot: <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) => prisma.$transaction(work, { timeout: 30000 }),
  sources: (tx: Prisma.TransactionClient, id: string, panel: boolean, financial: boolean, since: Date) => Promise.all([
    tx.invoice.findMany({ where: financial ? { OR: [{ userId: id }, { requiresReview: true }] } : { userId: id }, include: { audits: { where: { action: { in: ['REVIEW_REQUIRED', 'HISTORICAL_PAYMENT_RECEIVED'] } }, orderBy: { createdAt: 'desc' }, take: 1 } } }),
    tx.reservation.findMany({ where: panel ? { OR: [{ userId: id }, { status: 'PENDING' }] } : { userId: id }, include: { commonArea: true } }),
    tx.voting.findMany({ where: { createdAt: { gte: since }, endDate: { gte: new Date() } } }),
    panel ? tx.incident.findMany({ where: { status: 'OPEN' } }) : Promise.resolve([]),
  ]),
  async insertMissing(tx: Prisma.TransactionClient, data: Prisma.InboxNotificationCreateManyInput[]) {
    if (!data.length) return;
    const existing = await tx.inboxNotification.findMany({ where: { key: { in: data.map(item => item.key) } }, select: { key: true } });
    const keys = new Set(existing.map(item => item.key));
    const missing = data.filter(item => !keys.has(item.key));
    if (missing.length) await tx.inboxNotification.createMany({ data: missing, skipDuplicates: true });
  },
  list: (userId: string) => prisma.inboxNotification.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100 }),
  findOwned: (id: string, userId: string) => prisma.inboxNotification.findFirst({ where: { id, userId } }),
  read: (id: string) => prisma.inboxNotification.update({ where: { id }, data: { readAt: new Date() } }),
  users: () => prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true, role: true, isSyndic: true } }),
  prune: () => prisma.inboxNotification.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 180 * 86400000) } } }),
};
