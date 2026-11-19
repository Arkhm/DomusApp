import { z } from 'zod';
import { requiredString, upperCaseEnum } from './common';

const speciesSchema = upperCaseEnum(['CACHORRO', 'GATO', 'PASSARO', 'OUTRO'], 'Espécie inválida.');
const sizeSchema = upperCaseEnum(['PEQUENO', 'MEDIO', 'GRANDE'], 'Porte inválido.');

export const createPetSchema = z.object({
  name: requiredString('Nome é obrigatório.').max(191),
  species: speciesSchema,
  size: sizeSchema,
});

export const createManagedPetSchema = createPetSchema.extend({
  ownerId: z.string().uuid('Morador inválido.').optional(),
});

export const petQuerySchema = z.object({
  species: speciesSchema.optional(),
  size: sizeSchema.optional(),
  unitId: z.string().uuid('Unidade inválida.').optional(),
  block: z.string().trim().min(1).max(191).optional(),
  search: z.string().trim().max(191).optional(),
});
