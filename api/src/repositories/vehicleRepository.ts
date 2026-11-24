import type { VehicleFilters } from '../schemas/vehicleSchema';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const vehicleRepository = {
  update: (id: string, data: Prisma.VehicleUpdateInput) => prisma.vehicle.update({ where: { id }, data }),

  create: async (data: { plate: string; model: string; color: string | null; unitId: string }, tx: Prisma.TransactionClient = prisma) => {
    return await tx.vehicle.create({ data });
  },

  findAll: async ({ plate, unitId, block }: VehicleFilters = {}) => {
    return await prisma.vehicle.findMany({
      where: {
        ...(plate ? { plate: { contains: plate } } : {}),
        ...(unitId ? { unitId } : {}),
        ...(block ? { unit: { block } } : {}),
      },
      include: { unit: { select: {
        id: true, type: true, block: true, number: true, parkingSpots: true,
        _count: { select: { vehicles: true } },
      } } },
      orderBy: [{ unit: { block: 'asc' } }, { unit: { number: 'asc' } }, { plate: 'asc' }],
    });
  },

  findByUnit: async (unitId: string) => {
    return await prisma.vehicle.findMany({
      where: { unitId },
      orderBy: { createdAt: 'asc' },
    });
  },

  findById: async (id: string) => {
    return await prisma.vehicle.findUnique({ where: { id } });
  },

  findByPlate: async (plate: string, tx: Prisma.TransactionClient = prisma) => {
    return await tx.vehicle.findUnique({ where: { plate } });
  },

  countByUnit: async (unitId: string, tx: Prisma.TransactionClient = prisma) => {
    return await tx.vehicle.count({ where: { unitId } });
  },

  delete: async (id: string) => {
    return await prisma.vehicle.delete({ where: { id } });
  },
};
