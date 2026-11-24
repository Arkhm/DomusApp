import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const unitRepository = {
  lockUnits: async (ids: string[], tx: Prisma.TransactionClient) => {
    // Ordem fixa impede deadlocks em transferências entre unidades.
    for (const id of [...new Set(ids)].sort()) {
      await tx.$queryRaw`SELECT id FROM Unit WHERE id = ${id} FOR UPDATE`;
    }
  },
  withLockedUnit: <T>(id: string, work: (tx: Prisma.TransactionClient) => Promise<T>) =>
    prisma.$transaction(async tx => {
      await unitRepository.lockUnits([id], tx);
      return work(tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }),
  create: async (data: any) => {
    return await prisma.unit.create({ data });
  },

  findAll: async () => {
    return await prisma.unit.findMany({
      include: { parkingSpotRecords: { orderBy: { number: 'asc' } } },
      orderBy: [
        { block: 'asc' },
        { number: 'asc' }
      ]
    });
  },

  findById: async (id: string, tx: Prisma.TransactionClient = prisma) => {
    return await tx.unit.findUnique({
      where: { id },
      include: { residents: true } 
    });
  },

  findByBlockAndNumber: async (
    block: string | null,
    number: string,
    type?: 'APARTMENT' | 'HOUSE',
  ) => {
    return await prisma.unit.findFirst({
      where: { block, number, ...(type ? { type } : {}) }
    });
  },

  update: async (id: string, data: any, tx: Prisma.TransactionClient = prisma) => {
    return await tx.unit.update({
      where: { id },
      data
    });
  },

  delete: async (id: string) => {
    return await prisma.unit.delete({ where: { id } });
  }
};