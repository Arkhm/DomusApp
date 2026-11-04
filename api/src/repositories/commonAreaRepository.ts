import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { CommonAreaInput } from '../schemas/commonAreaSchema';

export const commonAreaRepository = {
  findAll: (panel: boolean) => prisma.commonArea.findMany({
    where: panel ? {} : { isActive: true }, orderBy: { name: 'asc' },
  }),
  findById: (id: string, tx: Prisma.TransactionClient = prisma) => tx.commonArea.findUnique({ where: { id } }),
  create: (data: CommonAreaInput) => prisma.commonArea.create({ data }),
  update: (id: string, data: Partial<CommonAreaInput>, tx: Prisma.TransactionClient) =>
    tx.commonArea.update({ where: { id }, data }),
  delete: (id: string, tx: Prisma.TransactionClient) => tx.commonArea.delete({ where: { id } }),
  hasFutureReservations: async (id: string, today: Date, tx: Prisma.TransactionClient) =>
    (await tx.reservation.count({ where: {
      commonAreaId: id, status: { in: ['PENDING', 'APPROVED'] }, date: { gte: today },
    } })) > 0,
  withLockedArea: <T>(id: string, work: (tx: Prisma.TransactionClient) => Promise<T>) =>
    prisma.$transaction(async tx => {
      // Todas as alterações de reservas da área usam o mesmo bloqueio.
      await tx.$queryRaw`SELECT id FROM CommonArea WHERE id = ${id} FOR UPDATE`;
      return work(tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }),
};
