import { prisma } from '../lib/prisma';

export const noticeRepository = {
  create: async (data: any) => {
    return await prisma.notice.create({ data });
  },

  // findAll para os Admins — inclui contagem de leituras
  findAll: async () => {
    return await prisma.notice.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { name: true, role: true } },
        targetUnit: true,
        _count: { select: { readBy: true } },
      },
    });
  },

  // Busca para 'ALL' ou para a unidade específica do morador.
  // Filtra DRAFT (só admins veem) e marca isRead a partir do readBy.
  findForUser: async (userId: string, unitId: string | null) => {
    const whereClause: any = {
      status: 'PUBLISHED',
      OR: [{ targetType: 'ALL' }],
    };

    if (unitId) {
      whereClause.OR.push({ targetType: 'UNIT', targetUnitId: unitId });
    }

    return await prisma.notice.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { name: true, role: true } },
        targetUnit: true,
        readBy: { where: { userId }, select: { id: true } },
      },
    });
  },

  findById: async (id: string) => {
    return await prisma.notice.findUnique({ where: { id } });
  },

  delete: async (id: string) => {
    return await prisma.notice.delete({ where: { id } });
  },

  markAsRead: async (noticeId: string, userId: string) => {
    return await prisma.noticeRead.upsert({
      where: { noticeId_userId: { noticeId, userId } },
      update: {},
      create: { noticeId, userId },
    });
  },

  // Conta destinatários de um aviso (moradores ativos).
  // Se targetType=UNIT, conta apenas residentes daquela unidade.
  // ADMIN/FUNCIONARIO não são destinatários — só MORADOR conta.
  countAddressees: async (notice: { targetType: string; targetUnitId: string | null }) => {
    const where: any = {
      status: 'ACTIVE',
      role: 'MORADOR',
    };
    if (notice.targetType === 'UNIT' && notice.targetUnitId) {
      where.unitId = notice.targetUnitId;
    }
    return await prisma.user.count({ where });
  },
};
