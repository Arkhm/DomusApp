import { z } from 'zod';
import { dateString, longText, requiredText, uuid } from './common';

export const createEventSchema = z
  .object({
    title: requiredText('Título', 150),
    content: longText('Conteúdo'),
    eventDate: dateString('Data do evento'),
    location: z.string().trim().max(200, 'Local deve ter no máximo 200 caracteres.').optional(),
    targetType: z
      .enum(['ALL', 'UNIT'], { error: 'Público-alvo inválido. Use ALL ou UNIT.' })
      .optional(),
    targetUnitId: uuid.optional(),
    category: z
      .enum(['ASSEMBLEIA', 'CONFRATERNIZACAO', 'MANUTENCAO', 'REUNIAO', 'OUTRO'], {
        error: 'Categoria inválida.',
      })
      .optional(),
    // O form manda `null` quando a capacidade fica em branco.
    capacity: z
      .number({ error: 'Capacidade deve ser um número.' })
      .int('Capacidade deve ser um número inteiro.')
      .min(1, 'Capacidade deve ser maior que zero.')
      .nullable()
      .optional(),
    status: z
      .enum(['DRAFT', 'PUBLISHED', 'CANCELLED'], {
        error: 'Status inválido. Use DRAFT, PUBLISHED ou CANCELLED.',
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.targetType === 'UNIT' && !data.targetUnitId) {
      ctx.addIssue({
        code: 'custom',
        path: ['targetUnitId'],
        message: 'Selecione a unidade de destino quando o público-alvo for UNIT.',
      });
    }
  });
