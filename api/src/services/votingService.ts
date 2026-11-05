import { updateVotingSchema } from '../schemas/updateSchemas';
import { UpdateActor, requireEditor, isSyndic } from '../lib/access';
import { Prisma } from '@prisma/client';
import { votingRepository } from '../repositories/votingRepository';
import { userRepository } from '../repositories/userRepository';
import { HttpError } from '../lib/httpError';

export const votingService = {
  async update(id: string, input: unknown, actor: UpdateActor) {
    requireEditor(actor, isSyndic(actor));
    return votingRepository.update(id, updateVotingSchema.parse(input));
  },

  async create(data: {
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    options: string[];
    authorId: string;
  }) {
    if (!data.title || !data.title.trim()) {
      throw new Error('Título é obrigatório.');
    }
    if (!data.description || !data.description.trim()) {
      throw new Error('Descrição é obrigatória.');
    }
    if (!data.startDate || !data.endDate) {
      throw new Error('Data de início e data de término são obrigatórias.');
    }

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (isNaN(startDate.getTime())) {
      throw new Error('Data de início inválida.');
    }
    if (isNaN(endDate.getTime())) {
      throw new Error('Data de término inválida.');
    }
    if (startDate >= endDate) {
      throw new Error('A data de início deve ser anterior à data de término.');
    }
    if (endDate <= new Date()) {
      throw new Error('A data de término deve estar no futuro.');
    }

    if (!Array.isArray(data.options) || data.options.length < 2) {
      throw new Error('A votação deve conter pelo menos duas opções.');
    }

    const cleanedOptions = data.options.map((opt) => (typeof opt === 'string' ? opt.trim() : ''));

    if (cleanedOptions.some((opt) => opt.length === 0)) {
      throw new Error('Todas as opções devem conter texto.');
    }

    return await votingRepository.create({
      title: data.title.trim(),
      description: data.description.trim(),
      startDate,
      endDate,
      authorId: data.authorId,
      options: cleanedOptions
    });
  },

  async list() {
    return await votingRepository.findAll();
  },

  async vote(votingId: string, optionId: string, userId: string) {
    const user = await userRepository.findById(userId);
    if (!user || user.role !== 'MORADOR' || !user.unitId) {
      throw new HttpError(403, 'Apenas moradores com unidade podem votar.');
    }

    const voting = await votingRepository.findById(votingId);
    if (!voting) {
      throw new HttpError(404, 'Votação não encontrada.');
    }

    // Limites inclusivos, como o getVotingStatus do web.
    const now = new Date();
    if (now < voting.startDate) {
      throw new Error('A votação ainda não começou.');
    }
    if (now > voting.endDate) {
      throw new Error('A votação já foi encerrada.');
    }
    if (!voting.options.some((option) => option.id === optionId)) {
      throw new Error('Opção inválida para esta votação.');
    }

    try {
      await votingRepository.castVote({ votingId, optionId, unitId: user.unitId, userId });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new HttpError(409, 'Sua unidade já votou nesta votação.');
      }
      throw error;
    }
    return { message: 'Voto registrado com sucesso.' };
  },

  async delete(id: string) {
    const voting = await votingRepository.findById(id);

    if (!voting) {
      throw new Error('Votação não encontrada.');
    }

    await votingRepository.delete(id);
    return { message: 'Votação removida com sucesso.' };
  }
};
