import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const petRepository = {
  update: (id: string, data: Prisma.PetUpdateInput) => prisma.pet.update({ where: { id }, data }),

  create: (data: { name: string; species: string; size: string; ownerId: string }) =>
    prisma.pet.create({ data }),

  findOwner: (id: string) => prisma.user.findUnique({
    where: { id }, select: { id: true, role: true, status: true },
  }),

  findAll: (where: Prisma.PetWhereInput = {}) => prisma.pet.findMany({
    where,
    include: { owner: { select: {
      id: true, name: true, phone: true,
      unit: { select: { id: true, type: true, block: true, number: true } },
    } } },
    orderBy: [{ owner: { unit: { block: 'asc' } } }, { owner: { unit: { number: 'asc' } } }, { name: 'asc' }, { id: 'asc' }],
  }),

  findByOwner: (ownerId: string) => prisma.pet.findMany({
    where: { ownerId }, orderBy: { createdAt: 'asc' },
  }),

  findById: (id: string) => prisma.pet.findUnique({ where: { id } }),
  delete: (id: string) => prisma.pet.delete({ where: { id } }),
};
