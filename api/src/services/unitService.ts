import { unitRepository } from '../repositories/unitRepository';

export const unitService = {

  async listAll() {
    return await unitRepository.findAll();
  },

  async getById(id: number) {
    const unit = await unitRepository.findById(id);
    if (!unit) throw new Error('Unidade nao encontrada.');
    return unit;
  },

  async create(data: any) {
    if (!data.block || !data.number) {
      throw new Error('Bloco e numero sao obrigatorios.');
    }

    const exists = await unitRepository.findByBlockAndNumber(data.block, data.number);
    if (exists) throw new Error('Ja existe uma unidade com esse bloco e numero.');

    return await unitRepository.create({ block: data.block, number: data.number });
  },

  async update(id: number, data: any) {
    const unit = await unitRepository.findById(id);
    if (!unit) throw new Error('Unidade nao encontrada.');

    if (data.block || data.number) {
      const block = data.block || unit.block;
      const number = data.number || unit.number;
      const exists = await unitRepository.findByBlockAndNumber(block, number);
      if (exists && exists.id !== id) {
        throw new Error('Ja existe uma unidade com esse bloco e numero.');
      }
    }

    return await unitRepository.update(id, data);
  },

  async delete(id: number) {
    const unit = await unitRepository.findById(id);
    if (!unit) throw new Error('Unidade nao encontrada.');
    await unitRepository.delete(id);
    return { message: 'Unidade removida com sucesso.' };
  },
};