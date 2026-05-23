import { votingRepository } from '../repositories/votingRepository';

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
  }
};
