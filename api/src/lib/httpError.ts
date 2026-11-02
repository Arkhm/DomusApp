// Erro de regra de negócio com status HTTP próprio. Os controllers usam
// `error.statusCode ?? 400`, então um `Error` comum continua virando 400.
export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}
