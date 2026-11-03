import { Prisma } from '@prisma/client';
import { votingRepository } from '../repositories/votingRepository';
import { userRepository } from '../repositories/userRepository';

export const votingService = {
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

  async delete(id: string) {
    const voting = await votingRepository.findById(id);

    if (!voting) {
      throw new Error('Votação não encontrada.');
    }

    await votingRepository.delete(id);
    return { message: 'Votação removida com sucesso.' };
  },

  async vote(votingId: string, optionId: string, userId: string) {
    if (!optionId) {
      throw new Error('Opção é obrigatória.');
    }

    const user = await userRepository.findById(userId);
    if (!user || user.role !== 'MORADOR' || user.status !== 'ACTIVE') {
      throw new Error('Somente moradores ativos podem votar.');
    }

    const voting = await votingRepository.findById(votingId);
    if (!voting) {
      throw new Error('Votação não encontrada.');
    }

    const now = new Date();
    if (now < voting.startDate) {
      throw new Error('Esta votação ainda não começou.');
    }
    if (now >= voting.endDate) {
      throw new Error('Esta votação já foi encerrada.');
    }

    if (!voting.options.some((option) => option.id === optionId)) {
      throw new Error('Opção inválida para esta votação.');
    }

    const previous = await votingRepository.findVote(votingId, userId);

    if (previous) {
      if (previous.optionId === optionId) {
        throw new Error('Você já votou nesta opção.');
      }

      const changed = await votingRepository.changeVote({
        id: previous.id,
        fromOptionId: previous.optionId,
        toOptionId: optionId
      });
      if (!changed) {
        throw new Error('Seu voto foi alterado em outra requisição. Tente novamente.');
      }

      return { message: 'Voto alterado com sucesso.' };
    }

    try {
      await votingRepository.castVote({ votingId, optionId, userId });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new Error('Seu voto foi registrado em outra requisição. Tente novamente.');
      }
      throw error;
    }

    return { message: 'Voto registrado com sucesso.' };
  }
};
