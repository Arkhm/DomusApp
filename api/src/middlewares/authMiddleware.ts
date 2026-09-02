import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AUTH_COOKIE, clearAuthCookie } from '../lib/authCookie';

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
    // Descriptografa e valida a assinatura usando o segredo do seu .env
    const secret = process.env.JWT_SECRET as string;
    const decoded = jwt.verify(token, secret) as { id: string; role: string };

    // Acopla os dados do usuário (id e role) na requisição.
    req.user = decoded;

    next();
  } catch (error) {
    // Token expirado/adulterado: derruba o cookie para o browser não continuar
    // reenviando lixo em toda requisição.
    clearAuthCookie(res);
    res.status(401).json({ error: 'Token inválido ou expirado.' });
    return;
  }
};
