import { z } from 'zod';
import { requiredString } from './common';

export const loginSchema = z.object({
  email: requiredString('E-mail é obrigatório.').email('E-mail inválido.'),
  password: z.string().min(1, 'Senha é obrigatória.'),
});

// Usado por /auth/register e /auth/register-admin — ambas criam um usuário
// só com nome, e-mail e senha. O CPF, exigido pelo model User, não é pedido
// por nenhuma das duas rotas hoje; isso já era assim antes deste schema e
// não faz parte da tarefa de validação.
export const registerSchema = z.object({
  name: requiredString('Nome deve ter pelo menos 2 caracteres.').min(2, 'Nome deve ter pelo menos 2 caracteres.').max(100),
  email: requiredString('E-mail é obrigatório.').email('E-mail inválido.'),
  password: z.string().min(8).refine(v => Buffer.byteLength(v, 'utf8') <= 72, 'Senha deve ter no maximo 72 bytes.'),
});

export const forgotPasswordSchema = z.object({ email: z.string().trim().email().max(191) });
export const resetPasswordSchema = z.object({
  token: z.string().uuid(),
  newPassword: registerSchema.shape.password,
});
