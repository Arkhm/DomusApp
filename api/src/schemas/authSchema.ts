import { z } from 'zod';
import { requiredString } from './common';

export const loginSchema = z.object({
  client: z.literal('mobile').optional(),
  email: requiredString('E-mail é obrigatório.').email('E-mail inválido.'),
  password: z.string().min(1, 'Senha é obrigatória.'),
});

const passwordSchema = z.string().min(8)
  .refine(v => Buffer.byteLength(v, 'utf8') <= 72, 'Senha deve ter no maximo 72 bytes.');

export const forgotPasswordSchema = z.object({ email: z.string().trim().email().max(191) });
export const resetPasswordSchema = z.object({
  token: z.string().uuid(),
  newPassword: passwordSchema,
});

export const refreshSchema = z.object({
  client: z.literal('mobile').optional(),
  refreshToken: z.string().min(1).max(4096).optional(),
}).default({});
