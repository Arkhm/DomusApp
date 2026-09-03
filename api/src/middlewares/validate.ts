import { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

// Onde procurar os dados a validar. `body` é o caso normal; `params` serve para
// barrar um :id malformado antes de ele virar uma query no banco.
type Target = 'body' | 'params' | 'query';

// Monta o mapa campo -> mensagens a partir dos issues do Zod. Não usamos o
// `.flatten()` da lib porque precisamos do caminho completo (ex: "options.1")
// para erros dentro de arrays.
const fieldErrors = (issues: { path: PropertyKey[]; message: string }[]) => {
  const details: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    (details[key] ??= []).push(issue.message);
  }
  return details;
};

/**
 * Middleware genérico de validação (Semana 3 do plano de adequação).
 *
 * Roda **antes** do controller: dado malformado é recusado com 400 na borda da
 * API e nunca chega ao Service nem ao Prisma.
 *
 * Além de validar, o parse do Zod **descarta campos não declarados** no schema.
 * Isso fecha mass assignment: um POST /users com `"id"` ou `"isSyndic"` extra
 * tem esses campos removidos antes de o objeto seguir para o repositório.
 *
 * O corpo da resposta mantém `error` (string legível) porque é o contrato que o
 * front já consome em `apiErrorMessage`, e acrescenta `details` com o mapa por
 * campo para quem quiser destacar o input errado.
 */
export const validate =
  (schema: ZodType, target: Target = 'body') =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const details = fieldErrors(result.error.issues);
      const summary = Object.entries(details)
        .map(([field, messages]) => (field === '_' ? messages[0] : `${field}: ${messages[0]}`))
        .join(' · ');

      res.status(400).json({ error: summary, details });
      return;
    }

    // Só o body é reescrito com o dado já normalizado (trim, coerção, campos
    // desconhecidos removidos). `req.query` é somente-leitura no Express 5 e
    // `req.params` é reescrito pelo router a cada match — para esses dois a
    // validação é uma barreira, não uma transformação.
    if (target === 'body') {
      req.body = result.data;
    }

    next();
  };
