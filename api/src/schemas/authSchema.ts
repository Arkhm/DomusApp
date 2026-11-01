import { z } from 'zod';
import { requiredString } from './common';

export const loginSchema = z.object({
  email: requiredString('E-mail é obrigatório.').email('E-mail inválido.'),
  password: requiredString('Senha é obrigatória.'),
});

// Usado por /auth/register e /auth/register-admin — ambas criam um usuário
// só com nome, e-mail e senha. O CPF, exigido pelo model User, não é pedido
// por nenhuma das duas rotas hoje; isso já era assim antes deste schema e
// não faz parte da tarefa de validação.
export const registerSchema = z.object({
  name: requiredString('Nome deve ter pelo menos 2 caracteres.').min(2, 'Nome deve ter pelo menos 2 caracteres.').max(100),
  email: requiredString('E-mail é obrigatório.').email('E-mail inválido.'),
  password: requiredString('Senha deve ter pelo menos 8 caracteres.').min(8, 'Senha deve ter pelo menos 8 caracteres.'),
});
