import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ParkingSpotInput } from '../schemas/parkingSpotSchema';

const include = { unit: { select: { id: true, type: true, block: true, number: true } } };
export const parkingSpotRepository = {
  findAll: (where: Prisma.ParkingSpotWhereInput) => prisma.parkingSpot.findMany({ where, include, orderBy: { number: 'asc' } }),
  findById: (id: string, tx: Prisma.TransactionClient) => tx.parkingSpot.findUnique({ where: { id }, include }),
  create: (data: ParkingSpotInput) => prisma.parkingSpot.create({ data, include }),
  update: (id: string, data: Partial<ParkingSpotInput> & { unitId?: string | null }, tx: Prisma.TransactionClient) =>
    tx.parkingSpot.update({ where: { id }, data, include }),
  delete: (id: string, tx: Prisma.TransactionClient) => tx.parkingSpot.delete({ where: { id } }),
  countByUnit: (unitId: string, tx: Prisma.TransactionClient) => tx.parkingSpot.count({ where: { unitId } }),
  withLockedSpot: <T>(id: string, work: (tx: Prisma.TransactionClient) => Promise<T>) =>
    prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM ParkingSpot WHERE id = ${id} FOR UPDATE`;
      return work(tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }),
};
