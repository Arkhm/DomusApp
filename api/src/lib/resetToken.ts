import crypto from 'crypto';

// Token bruto: 1h de validade (RF-007), vai por e-mail e no link, nunca é
// salvo no banco. Só o hash SHA-256 dele fica em `User.resetToken` — mesmo
// princípio do bcrypt nas senhas: se o banco vazar, o hash sozinho não deixa
// ninguém redefinir a senha de ninguém.
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateResetToken(): { token: string; tokenHash: string } {
  const token = crypto.randomUUID();
  return { token, tokenHash: hashResetToken(token) };
}
