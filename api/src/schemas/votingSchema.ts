import { z } from 'zod';
import { requiredString } from './common';

export const createVotingSchema = z
  .object({
    title: requiredString('Título é obrigatório.').max(200),
    description: requiredString('Descrição é obrigatória.'),
    startDate: requiredString('Data de início é obrigatória.').refine(
      (v) => !Number.isNaN(Date.parse(v)),
      'Data de início inválida.',
    ),
    endDate: requiredString('Data de término é obrigatória.').refine(
      (v) => !Number.isNaN(Date.parse(v)),
      'Data de término inválida.',
    ),
    options: z
      .array(requiredString('Todas as opções devem conter texto.'), {
        error: 'A votação deve conter pelo menos duas opções.',
      })
      .min(2, 'A votação deve conter pelo menos duas opções.'),
  })
  .refine((data) => new Date(data.startDate) < new Date(data.endDate), {
    message: 'A data de início deve ser anterior à data de término.',
    path: ['endDate'],
  });
