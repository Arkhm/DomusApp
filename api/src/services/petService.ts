import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/httpError';
import { updatePetSchema } from '../schemas/updateSchemas';
import { createManagedPetSchema, petQuerySchema } from '../schemas/petSchema';
import { UpdateActor, requireEditor } from '../lib/access';
import { petRepository } from '../repositories/petRepository';

export const petService = {
  async update(id: string, input: unknown, actor: UpdateActor) {
    requireEditor(actor, actor.role === 'MORADOR');
    const data = updatePetSchema.parse(input);
    const record = await petRepository.findById(id);
    if (!record) throw new HttpError(404, 'Registro não encontrado.');
    requireEditor(actor, actor.role === 'MORADOR' && record.ownerId === actor.id);
    return petRepository.update(id, data);
  },

  async listAll(input: unknown = {}) {
    const filters = petQuerySchema.parse(input);
    const where: Prisma.PetWhereInput = {};
    if (filters.species) where.species = filters.species;
    if (filters.size) where.size = filters.size;
    if (filters.unitId || filters.block) where.owner = {
      ...(filters.unitId ? { unitId: filters.unitId } : {}),
      ...(filters.block ? { unit: { block: filters.block } } : {}),
    };
    if (filters.search) where.OR = [
      { name: { contains: filters.search } },
      { owner: { name: { contains: filters.search } } },
    ];
    return petRepository.findAll(where);
  },

  async listMine(userId: string) {
    return petRepository.findByOwner(userId);
  },

  async create(userId: string, input: unknown, role: string = 'MORADOR') {
    if (role !== 'ADMIN' && role !== 'MORADOR') throw new HttpError(403, 'Você não tem permissão para cadastrar pets.');
    const data = createManagedPetSchema.parse(input);
    let ownerId = userId;
    if (role === 'ADMIN') {
      if (!data.ownerId) throw new HttpError(400, 'Informe o morador dono do pet.');
      const owner = await petRepository.findOwner(data.ownerId);
      if (!owner || owner.role !== 'MORADOR' || owner.status !== 'ACTIVE') {
        throw new HttpError(400, 'O dono deve ser um morador ativo.');
      }
      ownerId = owner.id;
    }
    // O app do morador mantém o dono autenticado, mesmo se enviar ownerId.
    return petRepository.create({ name: data.name, species: data.species, size: data.size, ownerId });
  },

  async delete(id: string, userId: string, role: string) {
    if (role !== 'ADMIN' && role !== 'MORADOR') throw new HttpError(403, 'Você não tem permissão para remover este pet.');
    const pet = await petRepository.findById(id);
    if (!pet) throw new HttpError(404, 'Pet não encontrado.');
    if (pet.ownerId !== userId && role !== 'ADMIN') {
      throw new HttpError(403, 'Você não tem permissão para remover este pet.');
    }
    await petRepository.delete(id);
    return { message: 'Pet removido com sucesso.' };
  },
};
