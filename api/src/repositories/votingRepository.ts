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

  findVote: async (votingId: string, userId: string) => {
    return await prisma.votingVote.findUnique({
      where: { votingId_userId: { votingId, userId } }
    });
  },

  changeVote: async (data: { id: string; fromOptionId: string; toOptionId: string }) => {
    return await prisma.$transaction(async (tx) => {
      const { count } = await tx.votingVote.updateMany({
        where: { id: data.id, optionId: data.fromOptionId },
        data: { optionId: data.toOptionId }
      });
      if (count === 0) return false;

      await tx.votingOption.update({
        where: { id: data.fromOptionId },
        data: { votes: { decrement: 1 } }
      });
      await tx.votingOption.update({
        where: { id: data.toOptionId },
        data: { votes: { increment: 1 } }
      });
      return true;
    });
  },

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
