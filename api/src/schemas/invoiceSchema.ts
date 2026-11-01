import { z } from 'zod';
import { money, validDate } from '../lib/paymentDomain';

const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(191);
const date = z.string().refine(value => {
  try { validDate(value, 'Data'); return true; } catch { return false; }
}, 'Data invalida.');
const status = z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'EXPIRED', 'REJECTED', 'REFUNDED', 'CHARGED_BACK', 'PARTIALLY_REFUNDED']);
const type = z.enum(['MONTHLY_FEE', 'EXTRAORDINARY', 'FINE', 'OTHER']);
const fields = {
  description: text,
  amount: z.union([z.string(), z.number()]).refine(value => {
    try { money(value); return true; } catch { return false; }
  }, 'Valor monetario invalido.'),
  dueDate: date,
  type: type.optional(),
  referenceMonth: date.nullable().optional(),
};
export const createInvoiceSchema = z.object({ ...fields, userId: uuid, unitId: uuid });
export const batchInvoiceSchema = z.object({ ...fields, userIds: z.array(uuid).min(1).max(100)
  .refine(ids => new Set(ids).size === ids.length, 'Usuarios repetidos.') });
export const invoiceQuerySchema = z.object({
  status: status.optional(), type: type.optional(), userId: uuid.optional(), unitId: uuid.optional(),
  startDate: date.optional(), endDate: date.optional(),
  page: z.string().regex(/^\d+$/).refine(v => Number(v) >= 1 && Number(v) <= 100000).optional(),
  limit: z.string().regex(/^\d+$/).refine(v => Number(v) >= 1 && Number(v) <= 100).optional(),
}).refine(v => !v.startDate || !v.endDate || new Date(v.startDate) <= new Date(v.endDate), 'Intervalo invalido.');
export const unitParamsSchema = z.object({ unitId: uuid });
export const invoiceReasonSchema = z.object({ reason: text.optional() }).default({});
export const invoiceStatusSchema = z.object({ status, reason: text.optional() });
// Only validate shape: signature verification still receives the original IDs and delivery fields.
const deliveryId = z.union([z.string().min(1), z.number().int().nonnegative()]);
export const webhookBodySchema = z.object({
  type: z.string().optional(), data: z.object({ id: deliveryId.optional() }).loose().optional(),
  user_id: deliveryId.optional(), live_mode: z.boolean().optional(),
}).loose();
export const webhookQuerySchema = z.object({ 'data.id': z.string().min(1).optional() }).loose();
