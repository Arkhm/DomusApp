import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    isSyndic?: boolean;
  };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  // O token é enviado pelo front-end no cabeçalho 'Authorization'
  // Formato esperado: "Bearer eyJhbGciOi..."
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
    return;
  }

  const [, token] = authHeader.split(' ');

  try {
    // Descriptografa e valida a assinatura usando o segredo do seu .env
    const secret = process.env.JWT_SECRET as string;
    const decoded = jwt.verify(token, secret) as { id: string; role: string; isSyndic?: boolean };

    // Acopla os dados do usuário (id e role) na requisição.
    req.user = decoded;

    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
    return;
  }
};