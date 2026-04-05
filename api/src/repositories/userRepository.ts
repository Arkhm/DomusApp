import { prisma } from '../lib/prisma';

export const userRepository = {
  findByEmail: async (email: string) => {
  return await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });
},
  findById: async (id: number) => {
    return await prisma.user.findUnique({
      where: { id },
      include: { role: true, unit: true },
    });
  },

  findAll: async () => {
    return await prisma.user.findMany({
      orderBy: { created_at: 'desc' },
      select: {
        id: true, name: true, email: true,
        is_active: true, created_at: true, updated_at: true,
        role: { select: { id: true, name: true } },
        unit: { select: { id: true, block: true, number: true } },
      },
    });
  },

  search: async (query: string) => {
    return await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { email: { contains: query } },
        ],
      },
      orderBy: { created_at: 'desc' },
      select: {
        id: true, name: true, email: true,
        is_active: true, created_at: true, updated_at: true,
        role: { select: { id: true, name: true } },
        unit: { select: { id: true, block: true, number: true } },
      },
    });
  },

  create: async (data: {
    name: string;
    email: string;
    password: string;
    role_id: number;
    unit_id?: number | null;
    is_active?: boolean;
  }) => {
    return await prisma.user.create({ data });
  },

  update: async (id: number, data: {
    name?: string;
    email?: string;
    password?: string;
    role_id?: number;
    unit_id?: number | null;
    is_active?: boolean;
  }) => {
    return await prisma.user.update({ where: { id }, data });
  },

  delete: async (id: number) => {
    return await prisma.user.delete({ where: { id } });
  },
};