import { prisma } from '../lib/prisma';

export const noticeRepository = {
  create: async (data: any) => {
    return await prisma.notice.create({ data });
  },

  // findAll para os Admins
  findAll: async () => {
    return await prisma.notice.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { name: true, role: true } },
        targetUnit: true
      }
    });
  },

  // Busca apenas para 'ALL' ou para a unidade específica da pessoa
  findForUser: async (unitId: string | null) => {
    const whereClause: any = {
      OR: [
        { targetType: 'ALL' }
      ]
    };

    if (unitId) {
      whereClause.OR.push({ targetType: 'UNIT', targetUnitId: unitId });
    }

    return await prisma.notice.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { name: true, role: true } },
        targetUnit: true
      }
    });
  },

  findById: async (id: string) => {
    return await prisma.notice.findUnique({ where: { id } });
  },

  delete: async (id: string) => {
    return await prisma.notice.delete({ where: { id } });
  }
};