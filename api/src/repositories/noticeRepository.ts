import { prisma } from '../lib/prisma';

export const noticeRepository = {
  create: async (data: any) => {
    return await prisma.notice.create({ data });
  },

  // findAll para os Admins
  findAll: async () => {
    return await prisma.notice.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        author: { select: { name: true, role_id: true } },
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
      orderBy: { created_at: 'desc' },
      include: {
        author: { select: { name: true, role: true } },
        targetUnit: true
      }
    });
  },

  findById: async (id: number) => {
    return await prisma.notice.findUnique({ where: { id } });
  },

  delete: async (id: number) => {
    return await prisma.notice.delete({ where: { id } });
  }
};