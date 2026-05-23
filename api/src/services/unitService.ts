import { unitRepository } from '../repositories/unitRepository';

const VALID_TYPES = new Set(['APARTMENT', 'HOUSE']);

export const unitService = {
  async create(data: { type?: string; block?: string; number: string }) {
    if (!data.number) {
      throw new Error('O número da unidade é obrigatório.');
    }

    const type = (data.type || 'APARTMENT').toUpperCase();
    if (!VALID_TYPES.has(type)) {
      throw new Error('Tipo de unidade inválido. Use APARTMENT ou HOUSE.');
    }

    // Duplicata é escopada por tipo: um apartamento "A · 101" não conflita com
    // uma casa "A · 101" — são tipologias distintas em condomínios mistos.
    const existingUnit = await unitRepository.findByBlockAndNumber(
      data.block || null,
      data.number,
      type,
    );
    if (existingUnit) {
      const label = type === 'HOUSE' ? 'casa' : 'apartamento';
      throw new Error(`Já existe um(a) ${label} com este bloco/quadra e número.`);
    }

    return await unitRepository.create({
      type,
      block: data.block || null,
      number: data.number,
    });
  },

  async listAll() {
    return await unitRepository.findAll();
  },

  async delete(id: string) {
    const unit = await unitRepository.findById(id);

    if (!unit) {
      throw new Error('Unidade não encontrada.');
    }

    if (unit.residents && unit.residents.length > 0) {
      throw new Error(
        'Não é possível excluir esta unidade pois existem moradores vinculados a ela. Remova ou transfira os moradores primeiro.',
      );
    }

    await unitRepository.delete(id);
    return { message: 'Unidade removida com sucesso.' };
  },
};
