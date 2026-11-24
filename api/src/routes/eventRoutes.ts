import { updateEventSchema } from '../schemas/updateSchemas';
import { idParamsSchema } from '../schemas/common';
import { Router } from 'express';
import { eventController } from '../controllers/eventController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validate';
import { createEventSchema } from '../schemas/eventSchema';

const router = Router();

router.use(authMiddleware);

router.get('/', eventController.list);

router.post('/', authorizeRole(['ADMIN', 'SYNDIC']), validate(createEventSchema), eventController.create);
router.put('/:id', authorizeRole(['ADMIN', 'SYNDIC']), validate(idParamsSchema, 'params'), validate(updateEventSchema), eventController.update);
router.delete('/:id', authorizeRole(['ADMIN', 'SYNDIC']), validate(idParamsSchema, 'params'), eventController.delete);

export default router;
