import { Router } from 'express';
import { z } from 'zod';
import { notificationController } from '../controllers/notificationController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validate';
import { uuid } from '../schemas/common';

const router = Router();
router.use(authMiddleware);
router.get('/', notificationController.list);
router.post('/:type/:id/read', validate(z.object({ type: z.enum(['NOTICE', 'EVENT']), id: uuid }), 'params'), notificationController.markRead);
export default router;
