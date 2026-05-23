import { prisma } from '../lib/prisma';

export const eventRepository = {
  create: async (data: any) => {
    return await prisma.event.create({ data });
  },

  findAll: async () => {
    return await prisma.event.findMany({
      orderBy: { eventDate: 'asc' },
      include: {
        author: { select: { name: true, role: true } },
        targetUnit: true
      }
    });
  },

  findForUser: async (unitId: string | null) => {
    const whereClause: any = {
      status: { in: ['PUBLISHED', 'CANCELLED'] }, // morador não vê DRAFT
      OR: [
        { targetType: 'ALL' }
      ]
    };

    if (unitId) {
      whereClause.OR.push({ targetType: 'UNIT', targetUnitId: unitId });
    }

    return await prisma.event.findMany({
      where: whereClause,
      orderBy: { eventDate: 'asc' },
      include: {
        author: { select: { name: true, role: true } },
        targetUnit: true
      }
    });
  },

  findById: async (id: string) => {
    return await prisma.event.findUnique({ where: { id } });
  },

  delete: async (id: string) => {
    return await prisma.event.delete({ where: { id } });
  }
};