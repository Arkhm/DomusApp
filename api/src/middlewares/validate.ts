import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodType } from 'zod';

// Formata o primeiro problema encontrado como "campo: mensagem", no mesmo
// formato de frase única que o resto da API já usa em `{ error }` (é o que
// o front lê em apiErrorMessage). O detalhamento campo-a-campo completo vai
// junto em `errors`, para o front usar se um dia precisar.
const formatError = (error: ZodError) => {
  const [first] = error.issues;
  const field = first?.path.join('.');
  const message = field ? `${field}: ${first.message}` : (first?.message ?? 'Dados inválidos.');
  return { message, fieldErrors: error.flatten().fieldErrors };
};

// Valida e sanitiza `req.body` contra um schema Zod antes de chegar no
// controller. Campos fora do schema são descartados silenciosamente — Zod
// ignora chaves desconhecidas por padrão em `z.object()` — o que também
// fecha uma brecha de mass assignment: sem isso, qualquer campo enviado no
// body seguia direto para o Service e, de lá, para o Prisma.
export const validate =
  (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const { message, fieldErrors } = formatError(result.error);
      res.status(400).json({ error: message, errors: fieldErrors });
      return;
    }

    req.body = result.data;
    next();
  };
