import { prisma } from '../lib/prisma';

export const notificationRepository = {
  findReads: (userId: string) => prisma.notificationRead.findMany({ where: { userId } }),
  markRead: (userId: string, type: string, sourceId: string) =>
    prisma.notificationRead.upsert({
      where: { userId_type_sourceId: { userId, type, sourceId } },
      create: { userId, type, sourceId },
      update: {},
    }),
};
