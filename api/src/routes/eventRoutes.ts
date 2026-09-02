import { Router } from 'express';
import { eventController } from '../controllers/eventController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', eventController.list);

router.post('/', authorizeRole(['ADMIN', 'SYNDIC']), eventController.create);
router.delete('/:id', authorizeRole(['ADMIN', 'SYNDIC']), eventController.delete);

export default router;