import { z } from 'zod';
import { requiredString } from './common';

export const createNoticeSchema = z
  .object({
    title: requiredString('Título é obrigatório.').max(200),
    content: requiredString('Conteúdo é obrigatório.'),
    targetType: z.enum(['ALL', 'UNIT']).optional(),
    targetUnitId: z.string().uuid('targetUnitId inválido.').optional(),
    status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
    priority: z.enum(['NORMAL', 'URGENT']).optional(),
  })
  .refine((data) => data.targetType !== 'UNIT' || !!data.targetUnitId, {
    message: 'targetUnitId é obrigatório quando targetType é UNIT.',
    path: ['targetUnitId'],
  });
