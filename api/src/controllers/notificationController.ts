import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/authMiddleware';
import { HttpError } from '../lib/httpError';
import type { NotificationType } from '../repositories/notificationRepository';
import { notificationService } from '../services/notificationService';

function respondError(res: Response, error: unknown) {
  if (error instanceof HttpError) res.status(error.statusCode).json({ error: error.message });
  else res.status(500).json({ error: 'Não foi possível atualizar as notificações.' });
}

export const notificationController = {
  async list(req: AuthRequest, res: Response) {
    try { res.json(await notificationService.list(req.user!.id)); }
    catch (error) { respondError(res, error); }
  },
  async markRead(req: AuthRequest, res: Response) {
    try {
      res.json(await notificationService.markRead(req.user!.id, req.params.type as NotificationType, req.params.id as string));
    } catch (error) { respondError(res, error); }
  },
};
