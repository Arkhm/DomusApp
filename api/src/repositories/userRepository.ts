import { prisma } from '../lib/prisma';

export const userRepository = {
  findByEmail: async (email: string) => {
    return await prisma.user.findUnique({ where: { email } });
  },

  findByCpf: async (cpf: string) => {
    return await prisma.user.findUnique({ where: { cpf } });
  },

  // RF-007 — o lookup do reset é feito pelo **hash** do token, nunca pelo token
  // em claro. `resetToken` é UNIQUE no banco, então isto usa índice.
  findByResetToken: async (hashedToken: string) => {
    return await prisma.user.findUnique({ where: { resetToken: hashedToken } });
  },

  findById: async (id: string) => {
    return await prisma.user.findUnique({ 
      where: { id },
      include: { unit: true } // Opcional, mas ótimo para a rota getById já trazer a casa
    });
  },

  findAll: async () => {
    return await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, email: true, cpf: true, phone: true,
        role: true,
        unitId: true,
        unit: true,  
        status: true, isSyndic: true, isCouncilMember: true,
        createdAt: true, updatedAt: true,
      },
    });
  },

  search: async (query: string) => {
    return await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { email: { contains: query } },
          { cpf: { contains: query } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, email: true, cpf: true, phone: true,
        role: true,
        unitId: true,
        unit: true, 
        status: true, isSyndic: true, isCouncilMember: true,
        createdAt: true, updatedAt: true,
      },
    });
  },

  create: async (data: any) => {
    return await prisma.user.create({ data });
  },

  update: async (id: string, data: any) => {
    return await prisma.user.update({
      where: { id },
      data,
    });
  },

  delete: async (id: string) => {
    return await prisma.user.delete({ where: { id } });
  },
};