import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/authMiddleware';
import { NotificationError, notificationService } from '../services/notificationService';

function respondError(res: Response, error: unknown) {
  if (error instanceof NotificationError) {
    res.status(error.status).json({ error: error.message });
  } else {
    console.error('[notifications]', error);
    res.status(500).json({ error: 'Não foi possível atualizar as notificações.' });
  }
}

export const notificationController = {
  async list(req: AuthRequest, res: Response) {
    try { res.json(await notificationService.list(req.user!.id)); }
    catch (error) { respondError(res, error); }
  },
  async markRead(req: AuthRequest, res: Response) {
    try {
      await notificationService.markRead(req.user!.id, req.params.type as string, req.params.id as string);
      res.json({ message: 'Notificação lida.' });
    } catch (error) { respondError(res, error); }
  },
};
