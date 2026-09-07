import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';

export const authorizeRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {

    if (!req.user) {
      res.status(401).json({ error: 'Acesso negado. Utilizador não autenticado.' });
      return;
    }

    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    // Checa o atributo "cargo virtual" SYNDIC
    if (allowedRoles.includes('SYNDIC') && req.user.isSyndic === true) {
      return next();
    }

    res.status(403).json({ 
      error: 'Acesso negado. Não tem permissões para realizar esta ação.' 
    });
    return;
  };
};