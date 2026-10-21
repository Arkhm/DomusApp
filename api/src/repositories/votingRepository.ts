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

  delete: async (id: string) => {
    return await prisma.voting.delete({ where: { id } });
  },

  findVotesByUser: async (userId: string) => {
    return await prisma.votingVote.findMany({
      where: { userId },
      select: { votingId: true, optionId: true }
    });
  },

  // O voto e o incremento da contagem andam juntos: se um falhar, nenhum vale.
  // A unique (votingId, userId) barra o segundo voto mesmo com duas requisições
  // simultâneas — quem perde a corrida recebe P2002 e a transação é desfeita.
  castVote: async (data: { votingId: string; optionId: string; userId: string }) => {
    return await prisma.$transaction(async (tx) => {
      await tx.votingVote.create({ data });
      await tx.votingOption.update({
        where: { id: data.optionId },
        data: { votes: { increment: 1 } }
      });
    });
  }
};
