import { Response } from 'express';
import type { CookieOptions } from 'express';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from './tokens';

// Nomes únicos dos cookies de sessão. Mantidos aqui para que middleware,
// controller e logout nunca saiam de sincronia.
export const AUTH_COOKIE = 'domusapp_token';
export const REFRESH_COOKIE = 'domusapp_refresh';

// O refresh token só é útil em /auth/refresh e /auth/logout. Restringir o path
// faz o browser parar de anexá-lo às outras ~30 rotas da API: o token de vida
// longa deixa de circular em requisições que não têm nada a ver com ele.
const REFRESH_PATH = '/auth';

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

const baseOptions = (): CookieOptions => ({
  httpOnly: true,   // JavaScript da página não enxerga o token (anti-XSS)
  secure: isSecure(),
  sameSite: sameSite(),
});

export const authCookieOptions = (): CookieOptions => ({
  ...baseOptions(),
  path: '/',
  maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
});

export const refreshCookieOptions = (): CookieOptions => ({
  ...baseOptions(),
  path: REFRESH_PATH,
  maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
});

export const setAuthCookie = (res: Response, token: string) => {
  res.cookie(AUTH_COOKIE, token, authCookieOptions());
};

export const setRefreshCookie = (res: Response, token: string) => {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions());
};

// `clearCookie` só apaga se os atributos (path incluído) baterem com os do
// `set` — daí reaproveitarmos as mesmas funções de opções.
export const clearAuthCookie = (res: Response) => {
  const { maxAge: _maxAge, ...options } = authCookieOptions();
  res.clearCookie(AUTH_COOKIE, options);
};

export const clearRefreshCookie = (res: Response) => {
  const { maxAge: _maxAge, ...options } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE, options);
};

// Logout derruba os dois: deixar o refresh vivo manteria a sessão renovável.
export const clearSessionCookies = (res: Response) => {
  clearAuthCookie(res);
  clearRefreshCookie(res);
};
