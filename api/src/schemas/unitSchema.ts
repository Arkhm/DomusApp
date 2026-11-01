import { z } from 'zod';
import { requiredString, upperCaseEnum } from './common';

export const createUnitSchema = z.object({
  type: upperCaseEnum(['APARTMENT', 'HOUSE'], 'Tipo de unidade inválido. Use APARTMENT ou HOUSE.').optional(),
  block: z.string().trim().max(50).optional(),
  parkingSpots: z.union([z.number(), z.string().min(1)]).pipe(z.coerce.number<string | number>().int().min(0).max(20)).optional(),
  number: requiredString('O número da unidade é obrigatório.').max(20),
});

export const updateUnitSchema = createUnitSchema.partial();
