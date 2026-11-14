import { Router } from 'express';
import { z } from 'zod';
import { notificationController } from '../controllers/notificationController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validate';
import { idParamsSchema } from '../schemas/common';

const router = Router();
router.use(authMiddleware);
router.get('/', notificationController.list);
router.post('/:type/:id/read', validate(idParamsSchema.extend({
  type: z.enum(['NOTICE', 'EVENT', 'INCIDENT'], { error: 'Use NOTICE, EVENT ou INCIDENT.' }),
}), 'params'), notificationController.markRead);
export default router;
