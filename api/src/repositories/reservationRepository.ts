import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

const select = {
  id: true, date: true, startTime: true, endTime: true, status: true,
  rejectionReason: true, createdAt: true,
  commonArea: { select: { id: true, name: true } },
  user: { select: { id: true, name: true, unit: { select: { id: true, block: true, number: true } } } },
} satisfies Prisma.ReservationSelect;

export const reservationRepository = {
  findAll: (where: Prisma.ReservationWhereInput) => prisma.reservation.findMany({
    where, select, orderBy: [{ date: 'desc' }, { startTime: 'asc' }],
  }),
  findById: (id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.reservation.findUnique({ where: { id }, select }),
  hasCollision: async (data: { commonAreaId: string; date: Date; startTime: string; endTime: string }, tx: Prisma.TransactionClient) =>
    (await tx.reservation.count({ where: {
      commonAreaId: data.commonAreaId, date: data.date, status: 'APPROVED',
      startTime: { lt: data.endTime }, endTime: { gt: data.startTime },
    } })) > 0,
  create: (data: Prisma.ReservationUncheckedCreateInput, tx: Prisma.TransactionClient) =>
    tx.reservation.create({ data, select }),
  update: (id: string, data: { status: 'APPROVED' | 'REJECTED' | 'CANCELLED'; rejectionReason?: string | null }, tx: Prisma.TransactionClient) =>
    tx.reservation.update({ where: { id }, data, select }),
};
