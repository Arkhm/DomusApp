import { z } from 'zod';
import { requiredString } from './common';

export const createVehicleSchema = z.object({
  plate: z.string().transform(v => v.replace(/[^A-Za-z0-9]/g, '').toUpperCase())
    .refine(v => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(v), 'Placa inválida.'),
  model: requiredString('Modelo é obrigatório.').max(191),
  color: z.string().trim().max(191).optional(),
});
// Separado do schema base, usado também pela edição, que nunca troca a unidade.
export const createVehicleRequestSchema = createVehicleSchema.extend({ unitId: z.string().uuid().optional() });
export const vehicleQuerySchema = z.object({
  plate: z.string().trim().max(20).optional(),
  unitId: z.string().uuid().optional(),
  block: z.string().trim().min(1).max(191).optional(),
});
export type VehicleFilters = z.infer<typeof vehicleQuerySchema>;
