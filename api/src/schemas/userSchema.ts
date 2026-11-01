import { z } from 'zod';
import { isValidCpf } from '../lib/cpf';
import { requiredString, upperCaseEnum } from './common';

const cpfDigits = requiredString('CPF é obrigatório.').transform((v) => v.replace(/\D/g, ''));

// Create: CPF é sempre novo, então o dígito verificador é conferido aqui.
const cpfCreateField = cpfDigits.refine((v) => isValidCpf(v), 'CPF inválido.');

// Update: só o formato. O front sempre reenvia o CPF atual do usuário junto
// com qualquer edição (nome, telefone, status...), e registros antigos/seed
// podem ter CPF sem dígito verificador válido — travar aqui quebraria a
// edição de qualquer outro campo desses usuários. O userService confere o
// dígito verificador, mas só quando o CPF muda de fato (mesma regra do
// front, ver UserFormModal `cpfUnchanged`).
const cpfUpdateField = cpfDigits.refine((v) => /^\d{11}$/.test(v), 'CPF deve conter 11 dígitos.');

// O front sempre manda telefone limpo (só dígitos) ou string vazia quando o
// campo é deixado em branco — nunca `undefined`. '' precisa continuar válida
// pra não quebrar o cadastro sem telefone.
const phoneField = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine(
    (v) => v.length === 0 || v.length === 10 || v.length === 11,
    'Telefone inválido. Use DDD + número (10 ou 11 dígitos).',
  )
  .optional();

// Campos comuns a create e update, exceto o `cpf` (que tem regra de
// validação diferente em cada caso — ver acima).
const baseUserFields = {
  name: requiredString('Nome deve ter pelo menos 2 caracteres.').min(2, 'Nome deve ter pelo menos 2 caracteres.').max(100),
  email: requiredString('E-mail é obrigatório.').email('E-mail inválido.'),
  phone: phoneField,
  password: requiredString('Senha deve ter pelo menos 8 caracteres.').min(8, 'Senha deve ter pelo menos 8 caracteres.'),
  role: upperCaseEnum(
    ['ADMIN', 'FUNCIONARIO', 'MORADOR'],
    'Cargo inválido. Use ADMIN, FUNCIONARIO ou MORADOR.',
  ).optional(),
  unitId: z.string().uuid('unitId inválido.').optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  isSyndic: z.boolean().optional(),
  isCouncilMember: z.boolean().optional(),
};

export const createUserSchema = z.object({ ...baseUserFields, cpf: cpfCreateField });

// Os mesmos campos, todos opcionais — quem decide o que é obrigatório em
// cada situação (ex.: MORADOR não pode ficar sem unitId) continua sendo o
// userService, que já carrega essas regras de negócio.
export const updateUserSchema = z.object({ ...baseUserFields, cpf: cpfUpdateField }).partial();
