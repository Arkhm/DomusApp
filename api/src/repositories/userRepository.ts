import { prisma } from '../lib/prisma';

export const userRepository = {
  findByEmail: async (email: string) => {
    return await prisma.user.findUnique({ where: { email } });
  },

  create: async (data: any) => {
    return await prisma.user.create({ data });
  }
};