import { prisma } from '../lib/prisma';

export const unitRepository = {
  create: async (data: any) => {
    return await prisma.unit.create({ data });
  },

  findAll: async () => {
    return await prisma.unit.findMany({
      orderBy: [
        { block: 'asc' },
        { number: 'asc' }
      ]
    });
  },

  findById: async (id: string) => {
    return await prisma.unit.findUnique({
      where: { id },
      include: { residents: true } 
    });
  },

  findByBlockAndNumber: async (block: string | null, number: string) => {
    return await prisma.unit.findFirst({
      where: { block, number }
    });
  },

  delete: async (id: string) => {
    return await prisma.unit.delete({ where: { id } });
  }
};