import { z } from 'zod';
import { requiredString } from './common';

const fields = {
  name: requiredString('Nome é obrigatório.').max(100, 'Nome deve ter até 100 caracteres.'),
  description: z.string().trim().nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  rules: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional(),
};
export const createCommonAreaSchema = z.object(fields);
export const updateCommonAreaSchema = z.object(fields).partial()
  .refine(data => Object.values(data).some(value => value !== undefined), 'Informe pelo menos um campo.');
export const commonAreaQuerySchema = z.object({});
export type CommonAreaInput = z.infer<typeof createCommonAreaSchema>;
