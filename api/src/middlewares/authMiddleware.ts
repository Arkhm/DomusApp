import { Request, Response, NextFunction } from 'express';
import { AUTH_COOKIE, clearAuthCookie } from '../lib/authCookie';
import { verifyAccessToken } from '../lib/tokens';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

// Fonte primária do token: o cookie httpOnly enviado automaticamente pelo
// browser. O header Authorization continua aceito como fallback para clientes
// que não têm cookie jar (Postman, testes, futuro app mobile com SecureStore).
const extractToken = (req: AuthRequest): string | undefined => {
  const cookieToken = req.cookies?.[AUTH_COOKIE];
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.authorization;
  if (!authHeader) return undefined;

  const [scheme, headerToken] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return undefined;

  return headerToken;
};

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
    return;
  }

  try {
    // Valida assinatura e prazo do access token (15 min) e acopla { id, role }.
    req.user = verifyAccessToken(token);

    next();
  } catch (error) {
    // Token expirado/adulterado: derruba **só** o cookie de acesso. O refresh
    // sobrevive de propósito — é com ele que o front chama /auth/refresh e
    // renova a sessão sem mandar o usuário de volta para a tela de login.
    clearAuthCookie(res);
    res.status(401).json({ error: 'Token inválido ou expirado.' });
    return;
  }
};
