import { z } from 'zod';
import { requiredString } from './common';

export const createVehicleSchema = z.object({
  plate: z.string().transform(v => v.replace(/[^A-Za-z0-9]/g, '').toUpperCase())
    .refine(v => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(v), 'Placa invalida.'),
  model: requiredString('Modelo e obrigatorio.').max(191),
  color: z.string().trim().max(191).optional(),
});
export const vehicleQuerySchema = z.object({ plate: z.string().max(20).optional() });
