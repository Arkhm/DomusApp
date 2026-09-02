import { Response } from 'express';
import type { CookieOptions } from 'express';

// Nome único do cookie de sessão. Mantido aqui para que middleware,
// controller e logout nunca saiam de sincronia.
export const AUTH_COOKIE = 'domusapp_token';

// 24h — mesma janela do `expiresIn` do JWT emitido no authService.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const isProduction = () => process.env.NODE_ENV === 'production';

// `secure: true` exige HTTPS. Em dev o front roda em http://localhost:5173,
// então o browser descartaria o cookie silenciosamente — por isso a flag
// acompanha o ambiente (e pode ser forçada com COOKIE_SECURE=true).
const isSecure = () =>
  process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProduction();

// 'strict' é o padrão e cobre localhost (front e API compartilham o mesmo site,
// portas não contam). Só precisa virar 'none' se um dia API e front ficarem em
// domínios registráveis diferentes — e aí 'none' obriga secure: true.
const sameSite = (): CookieOptions['sameSite'] => {
  const configured = process.env.COOKIE_SAMESITE?.toLowerCase();
  if (configured === 'lax' || configured === 'none' || configured === 'strict') {
    return configured;
  }
  return 'strict';
};

export const authCookieOptions = (): CookieOptions => ({
  httpOnly: true,   // JavaScript da página não enxerga o token (anti-XSS)
  secure: isSecure(),
  sameSite: sameSite(),
  path: '/',
  maxAge: MAX_AGE_MS,
});

export const setAuthCookie = (res: Response, token: string) => {
  res.cookie(AUTH_COOKIE, token, authCookieOptions());
};

// `clearCookie` só apaga se os atributos baterem com os do `set`.
export const clearAuthCookie = (res: Response) => {
  const { maxAge: _maxAge, ...options } = authCookieOptions();
  res.clearCookie(AUTH_COOKIE, options);
};
