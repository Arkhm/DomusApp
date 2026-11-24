import { Router } from 'express';
import { commonAreaController } from '../controllers/commonAreaController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validate';
import { idParamsSchema } from '../schemas/common';
import { commonAreaQuerySchema, createCommonAreaSchema, updateCommonAreaSchema } from '../schemas/commonAreaSchema';

const router = Router();
router.use(authMiddleware);
router.get('/', validate(commonAreaQuerySchema, 'query'), commonAreaController.list);
router.post('/', authorizeRole(['ADMIN']), validate(createCommonAreaSchema), commonAreaController.create);
router.put('/:id', authorizeRole(['ADMIN']), validate(idParamsSchema, 'params'), validate(updateCommonAreaSchema), commonAreaController.update);
router.delete('/:id', authorizeRole(['ADMIN']), validate(idParamsSchema, 'params'), commonAreaController.delete);
export default router;
