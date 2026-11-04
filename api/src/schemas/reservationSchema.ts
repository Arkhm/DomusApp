import { z } from 'zod';

export const reservationDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve usar YYYY-MM-DD.')
  .refine(value => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Data inválida.');
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário deve usar HH:mm.');
export const createReservationSchema = z.object({
  commonAreaId: z.string().uuid(), date: reservationDateSchema,
  startTime: timeSchema, endTime: timeSchema,
}).refine(data => data.startTime < data.endTime, 'O início deve ser anterior ao término.');
export const rejectReservationSchema = z.object({ reason: z.string().trim().max(500).optional() });
export const reservationQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  commonAreaId: z.string().uuid().optional(),
  from: reservationDateSchema.optional(), to: reservationDateSchema.optional(),
}).refine(data => !data.from || !data.to || data.from <= data.to, 'O início do filtro deve ser anterior ao término.');
export type ReservationInput = z.infer<typeof createReservationSchema>;
export type ReservationQuery = z.infer<typeof reservationQuerySchema>;
