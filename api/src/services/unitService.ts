import { unitRepository } from '../repositories/unitRepository';

export const unitService = {
  async create(data: { block?: string; number: string }) {
    if (!data.number) {
      throw new Error('O número da unidade é obrigatório.');
    }

    const existingUnit = await unitRepository.findByBlockAndNumber(data.block || null, data.number);
    if (existingUnit) {
      throw new Error('Já existe uma unidade cadastrada com este bloco e número.');
    }

    return await unitRepository.create(data);
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
      throw new Error('Não é possível excluir esta unidade pois existem moradores vinculados a ela. Remova ou transfira os moradores primeiro.');
    }

    await unitRepository.delete(id);
    return { message: 'Unidade removida com sucesso.' };
  }
};