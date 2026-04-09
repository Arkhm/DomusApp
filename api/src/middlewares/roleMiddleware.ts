import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';

export const authorizeRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {

    if (!req.user) {
      res.status(401).json({ error: 'Acesso negado. Utilizador não autenticado.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ 
        error: 'Acesso proibido. Não tem permissões para realizar esta ação.' 
      });
      return;
    }

    next();
  };
};