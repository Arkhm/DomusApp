import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const petRepository = {
  update: (id: string, data: Prisma.PetUpdateInput) => prisma.pet.update({ where: { id }, data }),

  create: async (data: { name: string; species: string; size: string; ownerId: string }) => {
    return await prisma.pet.create({ data });
  },

  findAll: async () => {
    return await prisma.pet.findMany({
      include: { owner: { select: { id: true, name: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  findByOwner: async (ownerId: string) => {
    return await prisma.pet.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'asc' },
    });
  },

  findById: async (id: string) => {
    return await prisma.pet.findUnique({ where: { id } });
  },

  delete: async (id: string) => {
    return await prisma.pet.delete({ where: { id } });
  },
};
