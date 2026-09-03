import { z } from 'zod';
import { email, password, requiredText } from './common';

/**
 * Cadastro público — o service força role MORADOR, então o schema nem aceita
 * `role`: se vier no corpo, o parse descarta antes de chegar ao service.
 *
 * ATENÇÃO: o schema espelha de propósito o que o `authService.register` usa
 * hoje (nome, email e senha). A rota já estava quebrada antes desta mudança —
 * `User.cpf` é obrigatório e único no banco, mas o service nunca o envia, então
 * o Prisma recusa o insert. Não foi "consertada" aqui porque fazer o cadastro
 * público voltar a funcionar é decisão de produto (quem pode se auto-cadastrar,
 * com qual unidade), não um detalhe de validação.
 */
export const registerSchema = z.object({
  name: requiredText('Nome', 100),
  email,
  password,
});

/**
 * Login valida apenas presença, nunca o formato da senha.
 *
 * Exigir `min(8)` aqui recusaria com 400 uma senha legada mais curta antes de
 * sequer consultar o banco — e a diferença entre "400 formato" e "401 inválida"
 * entregaria a política de senha para quem estivesse sondando a API.
 */
export const loginSchema = z.object({
  email: z.string({ error: 'E-mail é obrigatório.' }).trim().toLowerCase().min(1, 'E-mail é obrigatório.'),
  password: z.string({ error: 'Senha é obrigatória.' }).min(1, 'Senha é obrigatória.'),
});

// RF-007 — passo 1: pede o link de recuperação.
export const forgotPasswordSchema = z.object({ email });

// RF-007 — passo 2: troca a senha usando o token recebido por email.
// 64 caracteres hex = os 32 bytes aleatórios gerados no authService.
export const resetPasswordSchema = z.object({
  token: z
    .string({ error: 'Token é obrigatório.' })
    .trim()
    .regex(/^[a-f0-9]{64}$/i, 'Token de recuperação inválido.'),
  password,
});
