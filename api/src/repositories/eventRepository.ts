import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const eventRepository = {
  update: (id: string, data: Prisma.EventUncheckedUpdateInput) => prisma.event.update({ where: { id }, data, include: { author: { select: { name: true, role: true } }, targetUnit: true } }),

  create: async (data: any) => {
    // Inclui as relações pra response bater com o tipo `Event` consumido pelo front.
    return await prisma.event.create({
      data,
      include: {
        author: { select: { name: true, role: true } },
        targetUnit: true,
      },
    });
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