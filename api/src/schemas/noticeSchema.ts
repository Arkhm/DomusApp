import { z } from 'zod';
import { longText, requiredText, uuid } from './common';

// `authorId` não entra no schema de propósito: quem define o autor é o token
// JWT no controller. Se viesse no corpo, o parse o descarta — ninguém publica
// aviso em nome de outra pessoa.
export const createNoticeSchema = z
  .object({
    title: requiredText('Título', 150),
    content: longText('Conteúdo'),
    targetType: z
      .enum(['ALL', 'UNIT'], { error: 'Público-alvo inválido. Use ALL ou UNIT.' })
      .optional(),
    targetUnitId: uuid.optional(),
    status: z.enum(['DRAFT', 'PUBLISHED'], { error: 'Status inválido. Use DRAFT ou PUBLISHED.' }).optional(),
    priority: z
      .enum(['NORMAL', 'URGENT'], { error: 'Prioridade inválida. Use NORMAL ou URGENT.' })
      .optional(),
  })
  .superRefine((data, ctx) => {
    // Aviso direcionado sem unidade seria salvo e nunca apareceria para ninguém.
    if (data.targetType === 'UNIT' && !data.targetUnitId) {
      ctx.addIssue({
        code: 'custom',
        path: ['targetUnitId'],
        message: 'Selecione a unidade de destino quando o público-alvo for UNIT.',
      });
    }
  });
