import { z } from 'zod';
import { cpf, email, optionalPhone, password, requiredText, role, userStatus, uuid } from './common';

// Regra de negócio RNE-003: morador precisa de unidade. Validar aqui devolve o
// erro no formato de campo (`unitId`), em vez de uma string solta vinda do
// service — o front consegue destacar o input certo.
const requireUnitForMorador = <T extends { role?: string; unitId?: string | null }>(
  data: T,
  ctx: z.RefinementCtx
) => {
  // Role ausente vira MORADOR no service, então a exigência de unidade vale
  // igual para os dois casos.
  if ((data.role ?? 'MORADOR') === 'MORADOR' && !data.unitId) {
    ctx.addIssue({
      code: 'custom',
      path: ['unitId'],
      message: 'É obrigatório informar a unidade (unitId) para cadastrar um morador.',
    });
  }
};

export const createUserSchema = z
  .object({
    name: requiredText('Nome', 100),
    email,
    cpf,
    phone: optionalPhone,
    password,
    // Ausente = MORADOR, que é o default aplicado pelo service.
    role: role.optional(),
    status: userStatus.optional(),
    isSyndic: z.boolean().optional(),
    isCouncilMember: z.boolean().optional(),
    unitId: uuid.optional(),
  })
  .superRefine(requireUnitForMorador);

// No update tudo é opcional (o front manda só o que mudou), mas `unitId: null`
// precisa ser aceito para desvincular um morador — daí o `.nullable()`.
export const updateUserSchema = z
  .object({
    name: requiredText('Nome', 100).optional(),
    email: email.optional(),
    cpf: cpf.optional(),
    phone: optionalPhone,
    password: password.optional(),
    role: role.optional(),
    status: userStatus.optional(),
    isSyndic: z.boolean().optional(),
    isCouncilMember: z.boolean().optional(),
    unitId: uuid.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: 'Informe ao menos um campo para atualizar.',
  });
