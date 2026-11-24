import { IncidentCategory, IncidentStatus } from '@prisma/client';
import { z } from 'zod';
import { requiredString } from './common';

const category = z.enum(IncidentCategory, { error: 'Categoria inválida.' });
const status = z.enum(IncidentStatus, { error: 'Status inválido.' });

export const createIncidentSchema = z.object({
  title: requiredString('Título é obrigatório.').max(200, 'Título deve ter até 200 caracteres.'),
  description: requiredString('Descrição é obrigatória.'),
  category,
});

export const updateIncidentSchema = z.object({
  status: status.optional(),
  response: z.string({ error: 'Resposta inválida.' }).trim()
    .max(2000, 'Resposta deve ter até 2000 caracteres.').optional(),
}).refine(data => data.status !== undefined || data.response !== undefined, {
  message: 'Informe o status ou uma resposta.',
});

export const incidentQuerySchema = z.object({
  status: status.optional(),
  category: category.optional(),
});

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;
export type IncidentFilters = z.infer<typeof incidentQuerySchema>;
