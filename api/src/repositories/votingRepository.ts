import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/httpError';
import { z } from 'zod';
import { updateVotingSchema } from '../schemas/updateSchemas';
import { prisma } from '../lib/prisma';

export const votingRepository = {
  update: (id: string, data: z.infer<typeof updateVotingSchema>) => prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM Voting WHERE id = ${id} FOR UPDATE`;
    const voting = await tx.voting.findUnique({ where: { id }, include: {
      options: { orderBy: { createdAt: 'asc' } }, _count: { select: { ballots: true } },
    } });
    if (!voting) throw new HttpError(404, 'Votação não encontrada.');
    const now = new Date();
    if (voting.startDate <= now || voting._count.ballots > 0 || voting.options.some(option => option.votes > 0)) {
      throw new HttpError(409, 'Somente votações agendadas e sem votos podem ser editadas.');
    }
    const startDate = data.startDate ? new Date(data.startDate) : voting.startDate;
    const endDate = data.endDate ? new Date(data.endDate) : voting.endDate;
    if (startDate <= now || startDate >= endDate) throw new HttpError(400, 'Informe início futuro e término posterior ao início.');
    const { options, ...fields } = data;
    const changed = options && (options.length !== voting.options.length || options.some((text, i) => text !== voting.options[i]?.text));
    if (changed) await tx.votingOption.deleteMany({ where: { votingId: id } });
    return tx.voting.update({ where: { id }, data: { ...fields, startDate, endDate,
      ...(changed ? { options: { create: options.map(text => ({ text })) } } : {}),
    }, include: { author: { select: { name: true, role: true } }, options: { orderBy: { createdAt: 'asc' } } } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }),

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
      await tx.$queryRaw`SELECT id FROM Voting WHERE id = ${data.votingId} FOR UPDATE`;
      const voting = await tx.voting.findUnique({ where: { id: data.votingId }, include: { options: true } });
      if (!voting) throw new HttpError(404, 'Votação não encontrada.');
      const now = new Date();
      if (now < voting.startDate || now > voting.endDate) throw new HttpError(409, 'Votação fora do período de votação.');
      if (!voting.options.some(option => option.id === data.optionId)) throw new HttpError(400, 'Opção inválida para esta votação.');
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
