import { prisma } from '../lib/prisma';

export const invoiceRepository = {
  create: async (data: any) => {
    return await prisma.invoice.create({
      data,
      include: {
        user: { select: { id: true, name: true, email: true, cpf: true, phone: true, unit: true } },
        unit: true,
      },
    });
  },

  createMany: async (data: any[]) => {
    return await prisma.invoice.createMany({
      data,
      skipDuplicates: false,
    });
  },

  findById: async (id: string) => {
    return await prisma.invoice.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, cpf: true, phone: true, unit: true } },
        unit: true,
      },
    });
  },

  findByMpOrderId: async (mpOrderId: string) => {
    return await prisma.invoice.findUnique({
      where: { mpOrderId },
      include: {
        user: { select: { id: true, name: true, email: true, cpf: true, phone: true, unit: true } },
        unit: true,
      },
    });
  },

  findByMpPaymentId: async (mpPaymentId: string) => {
    return await prisma.invoice.findUnique({
      where: { mpPaymentId },
      include: {
        user: { select: { id: true, name: true, email: true, cpf: true, phone: true, unit: true } },
        unit: true,
      },
    });
  },

  findByUserId: async (userId: string, filters?: {
    status?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) => {
    const where: any = { userId };
    
    if (filters?.status) where.status = filters.status;
    if (filters?.type) where.type = filters.type;
    if (filters?.startDate || filters?.endDate) {
      where.dueDate = {};
      if (filters.startDate) where.dueDate.gte = filters.startDate;
      if (filters.endDate) where.dueDate.lte = filters.endDate;
    }

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        skip,
        take: limit,
        include: { unit: true },
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  findByUnitId: async (unitId: string, filters?: {
    status?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) => {
    const where: any = { unitId };
    
    if (filters?.status) where.status = filters.status;
    if (filters?.type) where.type = filters.type;
    if (filters?.startDate || filters?.endDate) {
      where.dueDate = {};
      if (filters.startDate) where.dueDate.gte = filters.startDate;
      if (filters.endDate) where.dueDate.lte = filters.endDate;
    }

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        skip,
        take: limit,
        include: { user: { select: { id: true, name: true, email: true, cpf: true, phone: true } } },
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  findAll: async (filters?: {
    status?: string;
    type?: string;
    userId?: string;
    unitId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) => {
    const where: any = {};
    
    if (filters?.status) where.status = filters.status;
    if (filters?.type) where.type = filters.type;
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.unitId) where.unitId = filters.unitId;
    if (filters?.startDate || filters?.endDate) {
      where.dueDate = {};
      if (filters.startDate) where.dueDate.gte = filters.startDate;
      if (filters.endDate) where.dueDate.lte = filters.endDate;
    }

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, cpf: true, phone: true, unit: true } },
          unit: true,
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  update: async (id: string, data: any) => {
    return await prisma.invoice.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, email: true, cpf: true, phone: true, unit: true } },
        unit: true,
      },
    });
  },

  updateByMpOrderId: async (mpOrderId: string, data: any) => {
    return await prisma.invoice.update({
      where: { mpOrderId },
      data,
      include: {
        user: { select: { id: true, name: true, email: true, cpf: true, phone: true, unit: true } },
        unit: true,
      },
    });
  },

  delete: async (id: string) => {
    return await prisma.invoice.delete({ where: { id } });
  },

  countByUser: async (userId: string, status?: string) => {
    return await prisma.invoice.count({
      where: { userId, ...(status ? { status } : {}) },
    });
  },

  sumAmountByUser: async (userId: string, status?: string) => {
    const result = await prisma.invoice.aggregate({
      where: { userId, ...(status ? { status } : {}) },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  },

  getOverdueInvoices: async () => {
    return await prisma.invoice.findMany({
      where: {
        status: 'PENDING',
        dueDate: { lt: new Date() },
      },
      include: {
        user: { select: { id: true, name: true, email: true, cpf: true, phone: true, unit: true } },
        unit: true,
      },
      orderBy: { dueDate: 'asc' },
    });
  },

  getStatsByUnit: async (unitId: string) => {
    const [total, pending, paid, overdue, totalAmount] = await Promise.all([
      prisma.invoice.count({ where: { unitId } }),
      prisma.invoice.count({ where: { unitId, status: 'PENDING' } }),
      prisma.invoice.count({ where: { unitId, status: 'PAID' } }),
      prisma.invoice.count({ where: { unitId, status: 'PENDING', dueDate: { lt: new Date() } } }),
      prisma.invoice.aggregate({
        where: { unitId },
        _sum: { amount: true },
      }),
    ]);

    return {
      total,
      pending,
      paid,
      overdue,
      totalAmount: totalAmount._sum.amount ?? 0,
    };
  },
};