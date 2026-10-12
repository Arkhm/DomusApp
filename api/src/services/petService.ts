import { petRepository } from '../repositories/petRepository';

const VALID_SPECIES = new Set(['CACHORRO', 'GATO', 'PASSARO', 'OUTRO']);
const VALID_SIZES = new Set(['PEQUENO', 'MEDIO', 'GRANDE']);

export const petService = {
  async listAll() {
    return await petRepository.findAll();
  },

  async listMine(userId: string) {
    return await petRepository.findByOwner(userId);
  },

  async create(userId: string, data: { name?: string; species?: string; size?: string }) {
    if (!data.name?.trim() || !data.species || !data.size) {
      throw new Error('Nome, espécie e porte são obrigatórios.');
    }

    const species = data.species.toUpperCase();
    if (!VALID_SPECIES.has(species)) {
      throw new Error('Espécie inválida. Use CACHORRO, GATO, PASSARO ou OUTRO.');
    }

    const size = data.size.toUpperCase();
    if (!VALID_SIZES.has(size)) {
      throw new Error('Porte inválido. Use PEQUENO, MEDIO ou GRANDE.');
    }

    return await petRepository.create({
      name: data.name.trim(),
      species,
      size,
      ownerId: userId,
    });
  },

  async delete(id: string, userId: string, role: string) {
    const pet = await petRepository.findById(id);
    if (!pet) throw new Error('Pet não encontrado.');

    if (pet.ownerId !== userId && role !== 'ADMIN') {
      throw new Error('Você não tem permissão para remover este pet.');
    }

    await petRepository.delete(id);
    return { message: 'Pet removido com sucesso.' };
  },
};
