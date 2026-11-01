import { z } from 'zod';
import { requiredString, upperCaseEnum } from './common';

export const createPetSchema = z.object({
  name: requiredString('Nome e obrigatorio.').max(191),
  species: upperCaseEnum(['CACHORRO', 'GATO', 'PASSARO', 'OUTRO'], 'Especie invalida.'),
  size: upperCaseEnum(['PEQUENO', 'MEDIO', 'GRANDE'], 'Porte invalido.'),
});
