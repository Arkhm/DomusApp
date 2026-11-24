import { userRepository } from '../repositories/userRepository';
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/authTokens';
import { AUTH_COOKIE, clearAuthCookie } from '../lib/authCookie';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    isSyndic?: boolean;
  };
}

// Fonte primária do token: o cookie httpOnly enviado automaticamente pelo
// browser. O header Authorization continua aceito como fallback para clientes
// que não têm cookie jar (Postman, testes, futuro app mobile com SecureStore).
export const extractToken = (req: AuthRequest): string | undefined => {
  const cookieToken = req.cookies?.[AUTH_COOKIE];
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.authorization;
  if (!authHeader) return undefined;

  const [scheme, headerToken] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return undefined;

  return headerToken;
};

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
    return;
  }

  let decoded: ReturnType<typeof verifyAccessToken>;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    clearAuthCookie(res);
    res.status(401).json({ error: 'Token inválido ou expirado.' });
    return;
  }

  let user;
  try {
    user = await userRepository.findAuthState(decoded.id);
  } catch {
    res.status(503).json({ error: 'Não foi possível validar a sessão. Tente novamente.' });
    return;
  }
  if (!user || user.status !== 'ACTIVE' || user.tokenVersion !== decoded.tokenVersion) {
    clearAuthCookie(res);
    res.status(401).json({ error: 'Sessão inválida ou revogada.' });
    return;
  }
  req.user = { id: user.id, role: user.role, isSyndic: user.isSyndic };
  next();
};
