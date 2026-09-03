import { z } from 'zod';

// Peças reutilizadas por mais de um schema. Centralizadas para que a regra de
// "o que é um CPF válido" tenha um único lugar para mudar.

export const uuid = z.uuid({ error: 'Identificador inválido.' });

// Rotas com :id — barra um id malformado antes de virar consulta no banco.
export const idParamSchema = z.object({ id: uuid });

export const requiredText = (field: string, max = 255) =>
  z
    .string({ error: `${field} é obrigatório.` })
    .trim()
    .min(1, `${field} é obrigatório.`)
    .max(max, `${field} deve ter no máximo ${max} caracteres.`);

export const longText = (field: string, max = 10000) =>
  z
    .string({ error: `${field} é obrigatório.` })
    .trim()
    .min(1, `${field} é obrigatório.`)
    .max(max, `${field} deve ter no máximo ${max} caracteres.`);

export const email = z
  .string({ error: 'E-mail é obrigatório.' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'E-mail inválido.' }));

// 8 caracteres é o piso definido no plano de adequação.
export const password = z
  .string({ error: 'Senha é obrigatória.' })
  .min(8, 'A senha deve ter ao menos 8 caracteres.')
  .max(128, 'A senha deve ter no máximo 128 caracteres.');

// O front já remove a máscara antes de enviar (`cpf.replace(/\D/g, '')`), então
// aqui esperamos apenas os 11 dígitos.
export const cpf = z
  .string({ error: 'CPF é obrigatório.' })
  .trim()
  .regex(/^\d{11}$/, 'CPF deve conter exatamente 11 dígitos, sem pontos ou traço.');

// O formulário de usuário manda string vazia quando o telefone fica em branco —
// tratamos isso como "não informado" em vez de recusar o cadastro.
export const optionalPhone = z
  .string()
  .trim()
  .regex(/^(\d{10,11})?$/, 'Telefone deve conter 10 ou 11 dígitos (DDD + número).')
  .optional();

export const role = z.enum(['ADMIN', 'FUNCIONARIO', 'MORADOR'], {
  error: 'Cargo inválido. Use ADMIN, FUNCIONARIO ou MORADOR.',
});

export const userStatus = z.enum(['ACTIVE', 'INACTIVE'], {
  error: 'Status inválido. Use ACTIVE ou INACTIVE.',
});

/**
 * Data em texto. Aceita qualquer formato que o `Date` do JS entenda — o front
 * manda ISO 8601 de `toISOString()`, mas Postman e o futuro app mobile podem
 * mandar outras variações. O que importa é recusar o que não vira data.
 */
export const dateString = (field: string) =>
  z
    .string({ error: `${field} é obrigatória.` })
    .trim()
    .min(1, `${field} é obrigatória.`)
    .refine((value) => !Number.isNaN(Date.parse(value)), `${field} inválida.`);
