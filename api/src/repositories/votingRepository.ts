import { prisma } from '../lib/prisma';

export const votingRepository = {
  create: async (data: {
    title: string;
    description: string;
    startDate: Date;
    endDate: Date;
    authorId: string;
    options: string[];
  }) => {
    return await prisma.$transaction(async (tx) => {
      const voting = await tx.voting.create({
        data: {
          title: data.title,
          description: data.description,
          startDate: data.startDate,
          endDate: data.endDate,
          authorId: data.authorId,
          options: {
            create: data.options.map((text) => ({ text }))
          }
        },
        include: {
          author: { select: { name: true, role: true } },
          options: { orderBy: { createdAt: 'asc' } }
        }
      });
      return voting;
    });
  },

  findAll: async () => {
    return await prisma.voting.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { name: true, role: true } },
        options: { orderBy: { createdAt: 'asc' } }
      }
    });
  },

  findById: async (id: string) => {
    return await prisma.voting.findUnique({
      where: { id },
      include: {
        author: { select: { name: true, role: true } },
        options: { orderBy: { createdAt: 'asc' } }
      }
    });
  },

  // Cria o voto e incrementa o total da opção na mesma transação. O
  // @@unique([votingId, unitId]) faz o segundo voto da unidade falhar com P2002.
  castVote: async (data: { votingId: string; optionId: string; unitId: string; userId: string }) => {
    return await prisma.$transaction(async (tx) => {
      await tx.votingVote.create({ data });
      return await tx.votingOption.update({
        where: { id: data.optionId },
        data: { votes: { increment: 1 } },
      });
    });
  },

  delete: async (id: string) => {
    return await prisma.voting.delete({ where: { id } });
  }
};
