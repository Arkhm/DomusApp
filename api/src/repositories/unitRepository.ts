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

  // Tipagem estrita: aceita apenas os valores válidos do enum, não string solta.
  // Antes "house" minúsculo passaria silenciosamente no TS — agora dá erro de
  // compilação no chamador, forçando uppercase consistente.
  findByBlockAndNumber: async (
    block: string | null,
    number: string,
    type?: 'APARTMENT' | 'HOUSE',
  ) => {
    return await prisma.unit.findFirst({
      where: { block, number, ...(type ? { type } : {}) }
    });
  },

  delete: async (id: string) => {
    return await prisma.unit.delete({ where: { id } });
  }
};