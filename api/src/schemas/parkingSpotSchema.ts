import { z } from 'zod';
import { requiredString } from './common';

export const parkingTypeSchema = z.enum(['RESIDENT', 'VISITOR', 'DISABLED'], { error: 'Tipo de vaga inválido.' });
const numberSchema = requiredString('O número da vaga é obrigatório.')
  .transform(value => value.replace(/\s+/g, '').toUpperCase())
  .pipe(z.string().min(1).max(80));
export const createParkingSpotSchema = z.object({ number: numberSchema, type: parkingTypeSchema }).strict();
export const updateParkingSpotSchema = createParkingSpotSchema.partial()
  .refine(data => Object.keys(data).length > 0, 'Informe ao menos um campo para atualizar.');
export const assignParkingSpotSchema = z.object({ unitId: z.string().uuid().nullable() }).strict();
export const parkingSpotQuerySchema = z.object({
  type: parkingTypeSchema.optional(),
  unitId: z.string().uuid().optional(),
  block: z.string().trim().max(50).optional(),
  free: z.enum(['true', 'false']).optional(),
});
export type ParkingSpotInput = z.infer<typeof createParkingSpotSchema>;
export type ParkingSpotQuery = z.infer<typeof parkingSpotQuerySchema>;
