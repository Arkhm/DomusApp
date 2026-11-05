import { z } from 'zod';
import { createNoticeSchema } from './noticeSchema';
import { createEventSchema } from './eventSchema';
import { createVotingSchema } from './votingSchema';
import { createVehicleSchema } from './vehicleSchema';
import { createPetSchema } from './petSchema';

const nonEmpty = (data: object) => Object.values(data).some(value => value !== undefined);
const title = z.string().trim().min(1).max(191);
export const updateNoticeSchema = z.object({ ...createNoticeSchema.shape, title,
  targetUnitId: z.string().uuid().nullable().optional(),
}).partial().refine(nonEmpty, 'Informe pelo menos um campo editável.');
export const updateEventSchema = z.object({ ...createEventSchema.shape, title,
  location: z.string().trim().max(191).nullable().optional(),
  targetUnitId: z.string().uuid().nullable().optional(),
}).partial().refine(nonEmpty, 'Informe pelo menos um campo editável.');
export const updateVotingSchema = z.object({ ...createVotingSchema.shape, title,
  options: z.array(z.string().trim().min(1).max(191)).min(2),
}).partial().refine(nonEmpty, 'Informe pelo menos um campo editável.');
export const updateVehicleSchema = z.object({ ...createVehicleSchema.shape,
  color: z.string().trim().max(191).nullable().optional(),
}).partial().refine(nonEmpty, 'Informe pelo menos um campo editável.');
export const updatePetSchema = createPetSchema.partial().refine(nonEmpty, 'Informe pelo menos um campo editável.');
