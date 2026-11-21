import { inboxService } from '../services/inboxService';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Router } from 'express';
import { z } from 'zod';
import { notificationController } from '../controllers/notificationController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validate';
import { idParamsSchema } from '../schemas/common';

const router = Router();
router.use(authMiddleware);
router.post('/inbox/:id/read', validate(idParamsSchema, 'params'), async (req: AuthRequest, res) => {
  try { await inboxService.read(req.user!, req.params.id as string); res.json({ message: 'Notificação lida.' }); }
  catch (error: any) { res.status(error.statusCode ?? 503).json({ error: error.statusCode ? error.message : 'Não foi possível registrar leitura.' }); }
});
router.get('/', notificationController.list);
router.post('/:type/:id/read', validate(idParamsSchema.extend({
  type: z.enum(['NOTICE', 'EVENT', 'INCIDENT'], { error: 'Use NOTICE, EVENT ou INCIDENT.' }),
}), 'params'), notificationController.markRead);
export default router;
