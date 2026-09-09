import { z } from 'zod';
import { requiredString } from './common';

export const createEventSchema = z
  .object({
    title: requiredString('Título é obrigatório.').max(200),
    content: requiredString('Conteúdo é obrigatório.'),
    eventDate: requiredString('Data do evento é obrigatória.').refine(
      (v) => !Number.isNaN(Date.parse(v)),
      'Data do evento inválida.',
    ),
    location: z.string().trim().max(200).optional(),
    targetType: z.enum(['ALL', 'UNIT']).optional(),
    targetUnitId: z.string().uuid('targetUnitId inválido.').optional(),
    category: z.enum(['ASSEMBLEIA', 'CONFRATERNIZACAO', 'MANUTENCAO', 'REUNIAO', 'OUTRO']).optional(),
    capacity: z.number().int().positive('Capacidade deve ser um número inteiro maior que zero.').optional().nullable(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED']).optional(),
  })
  .refine((data) => data.targetType !== 'UNIT' || !!data.targetUnitId, {
    message: 'targetUnitId é obrigatório quando targetType é UNIT.',
    path: ['targetUnitId'],
  });
