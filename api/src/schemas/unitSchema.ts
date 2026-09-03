import { z } from 'zod';
import { requiredText } from './common';

// O service já normaliza com `.toUpperCase()`; o schema aceita as duas grafias
// para não recusar um cliente que mande "apartment" minúsculo.
const unitType = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(
    z.enum(['APARTMENT', 'HOUSE'], {
      error: 'Tipo de unidade inválido. Use APARTMENT ou HOUSE.',
    })
  );

export const createUnitSchema = z.object({
  type: unitType.optional(),
  // Bloco/quadra é opcional; o form manda `undefined` quando vazio.
  block: z.string().trim().max(50, 'Bloco deve ter no máximo 50 caracteres.').optional(),
  number: requiredText('Número da unidade', 20),
});

export const updateUnitSchema = z
  .object({
    type: unitType.optional(),
    block: z.string().trim().max(50, 'Bloco deve ter no máximo 50 caracteres.').optional(),
    number: requiredText('Número da unidade', 20).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: 'Informe ao menos um campo para atualizar.',
  });
