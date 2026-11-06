import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const vehicleRepository = {
  update: (id: string, data: Prisma.VehicleUpdateInput) => prisma.vehicle.update({ where: { id }, data }),

  create: async (data: { plate: string; model: string; color: string | null; unitId: string }) => {
    return await prisma.vehicle.create({ data });
  },

  findAll: async (plate?: string) => {
    return await prisma.vehicle.findMany({
      where: plate ? { plate: { contains: plate } } : undefined,
      include: { unit: true },
      orderBy: { createdAt: 'desc' },
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

  findByPlate: async (plate: string) => {
    return await prisma.vehicle.findUnique({ where: { plate } });
  },

  countByUnit: async (unitId: string) => {
    return await prisma.vehicle.count({ where: { unitId } });
  },

  delete: async (id: string) => {
    return await prisma.vehicle.delete({ where: { id } });
  },
};
