import { z } from 'zod';
import { dateString, longText, requiredText } from './common';

export const createVotingSchema = z
  .object({
    title: requiredText('Título', 150),
    description: longText('Descrição'),
    startDate: dateString('Data de início'),
    endDate: dateString('Data de término'),
    options: z
      .array(requiredText('Opção', 120), { error: 'As opções da votação são obrigatórias.' })
      .min(2, 'A votação deve conter pelo menos duas opções.')
      .max(20, 'A votação deve ter no máximo 20 opções.'),
  })
  .superRefine((data, ctx) => {
    // A comparação vive aqui (e não só no service) para o erro sair no formato
    // de campo, apontando qual das duas datas está errada.
    if (Date.parse(data.startDate) >= Date.parse(data.endDate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'A data de início deve ser anterior à data de término.',
      });
    }

    // Duas opções com o mesmo texto tornam o resultado da votação ambíguo.
    const normalized = data.options.map((option) => option.toLowerCase());
    if (new Set(normalized).size !== normalized.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'As opções da votação não podem se repetir.',
      });
    }
  });
