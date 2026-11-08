import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';

export function validateAuthSecrets() {
  const accessSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!accessSecret || !refreshSecret || accessSecret === refreshSecret) {
    throw new Error('JWT_SECRET e JWT_REFRESH_SECRET devem estar definidos e ser diferentes.');
  }
  return { accessSecret, refreshSecret };
}
const issuer = 'domusapp';
const accessAudience = 'domusapp:access';
const refreshAudience = 'domusapp:refresh';

type TokenUser = { id: string; role: string; isSyndic: boolean; tokenVersion: number };
export function createAuthTokens(user: TokenUser) {
  const { accessSecret, refreshSecret } = validateAuthSecrets();
  return {
    token: jwt.sign({ id: user.id, role: user.role, isSyndic: user.isSyndic, tokenVersion: user.tokenVersion }, accessSecret, {
      algorithm: 'HS256', expiresIn: '15m', issuer, audience: accessAudience, jwtid: randomUUID(),
    }),
    refreshToken: jwt.sign({ tokenVersion: user.tokenVersion }, refreshSecret, {
      algorithm: 'HS256', expiresIn: '7d', issuer, audience: refreshAudience, subject: user.id, jwtid: randomUUID(),
    }),
  };
}
export function verifyAccessToken(token: string, options: { ignoreExpiration?: boolean } = {}) {
  const { accessSecret } = validateAuthSecrets();
  const payload = jwt.verify(token, accessSecret, { algorithms: ['HS256'], issuer, audience: accessAudience,
    ignoreExpiration: options.ignoreExpiration ?? false });
  if (typeof payload === 'string' || typeof payload.id !== 'string' || typeof payload.role !== 'string' || !Number.isInteger(payload.tokenVersion) || payload.tokenVersion < 0) {
    throw new Error('Token inválido.');
  }
  return { id: payload.id, role: payload.role, isSyndic: payload.isSyndic === true, tokenVersion: payload.tokenVersion as number };
}
// Tokens emitidos antes do tokenVersion no access (PR #35) não passam pelo
// verifyAccessToken, mas o refresh da mesma sessão continua válido por até 7 dias.
// No logout, um access legado assinado e recente revoga sem condição de versão.
const LEGACY_LOGOUT_WINDOW_S = 7 * 24 * 60 * 60;
export function verifyLogoutToken(token: string): { id: string; tokenVersion?: number } {
  try {
    const { id, tokenVersion } = verifyAccessToken(token, { ignoreExpiration: true });
    return { id, tokenVersion };
  } catch (error) {
    const { accessSecret } = validateAuthSecrets();
    const payload = jwt.verify(token, accessSecret, { algorithms: ['HS256'], issuer, audience: accessAudience,
      ignoreExpiration: true });
    const legacy = typeof payload !== 'string' && typeof payload.id === 'string' && payload.tokenVersion === undefined
      && typeof payload.iat === 'number' && Date.now() / 1000 - payload.iat <= LEGACY_LOGOUT_WINDOW_S;
    if (!legacy) throw error;
    return { id: payload.id };
  }
}
export function verifyRefreshToken(token: string) {
  const { refreshSecret } = validateAuthSecrets();
  const payload = jwt.verify(token, refreshSecret, { algorithms: ['HS256'], issuer, audience: refreshAudience });
  if (typeof payload === 'string' || typeof payload.sub !== 'string' || !payload.sub || !Number.isInteger(payload.tokenVersion) || payload.tokenVersion < 0) {
    throw new Error('Refresh token inválido.');
  }
  return { sub: payload.sub, tokenVersion: payload.tokenVersion as number };
}
