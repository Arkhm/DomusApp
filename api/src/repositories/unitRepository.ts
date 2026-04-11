import { prisma } from '../lib/prisma';

export const unitRepository = {

  findAll: async () => {
    return await prisma.unit.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        block: true,
        number: true,
        created_at: true,
        users: {
          select: { id: true, name: true, email: true }
        },
      },
    });
  },

  findById: async (id: number) => {
    return await prisma.unit.findUnique({
      where: { id },
      select: {
        id: true,
        block: true,
        number: true,
        created_at: true,
        users: {
          select: { id: true, name: true, email: true }
        },
      },
    });
  },

  findByBlockAndNumber: async (block: string, number: string) => {
    return await prisma.unit.findFirst({
      where: { block, number },
    });
  },

  create: async (data: { block: string; number: string }) => {
    return await prisma.unit.create({ data });
  },

  update: async (id: number, data: { block?: string; number?: string }) => {
    return await prisma.unit.update({ where: { id }, data });
  },


  delete: async (id: number) => {
    return await prisma.unit.delete({ where: { id } });
  },
};