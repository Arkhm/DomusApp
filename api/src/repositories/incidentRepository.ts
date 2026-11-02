import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

const select = {
  id: true, title: true, description: true, category: true, status: true,
  response: true, respondedAt: true, createdAt: true, updatedAt: true,
  author: { select: { id: true, name: true } },
  unit: { select: { id: true, block: true, number: true } },
} satisfies Prisma.IncidentSelect;

export const incidentRepository = {
  findAll: async (where: Prisma.IncidentWhereInput) => {
    return await prisma.incident.findMany({ where, select, orderBy: { createdAt: 'desc' } });
  },

  findById: async (id: string, authorId?: string) => {
    return await prisma.incident.findFirst({ where: { id, authorId }, select });
  },

  create: async (data: {
    title: string; description: string; category: Prisma.IncidentCreateInput['category'];
    authorId: string; unitId: string;
  }) => {
    return await prisma.incident.create({ data, select });
  },

  update: async (id: string, data: {
    status?: Prisma.IncidentUpdateInput['status']; response?: string; respondedAt?: Date;
  }) => {
    // A condição na escrita impede que uma resposta concorrente altere uma ocorrência encerrada.
    return await prisma.$transaction(async tx => {
      const result = await tx.incident.updateMany({ where: { id, status: { not: 'CLOSED' } }, data });
      if (result.count === 0) return null;
      return await tx.incident.findUnique({ where: { id }, select });
    });
  },
};
