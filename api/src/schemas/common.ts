import { z } from 'zod';

// Zod distingue "campo ausente" (invalid_type) de "campo vazio" (too_small) —
// sem o `{ error }` no `z.string(...)` base, um JSON que simplesmente omite a
// chave cai na mensagem padrão em inglês em vez da mensagem em português do
// `.min(1, ...)`. Este helper cobre os dois casos com uma mensagem só.
export const requiredString = (message: string) => z.string({ error: message }).trim().min(1, message);

// Alguns campos do domínio já eram tolerantes a caixa antes deste schema —
// userService e unitService fazem `.toUpperCase()` no valor recebido antes
// de validar contra a lista de opções. Este helper preserva esse
// comportamento em vez de rejeitar algo que a camada de serviço sempre
// aceitou (ex.: "apartment" continua virando "APARTMENT").
export const upperCaseEnum = (values: readonly string[], message: string) =>
  z
    .string()
    .transform((v) => v.toUpperCase())
    .refine((v) => values.includes(v), message);
