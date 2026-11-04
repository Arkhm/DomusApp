import { createPetSchema } from '../schemas/petSchema';
import { idParamsSchema } from '../schemas/common';
import { validate } from '../middlewares/validate';
import { Router } from 'express';
import { petController } from '../controllers/petController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', authorizeRole(['ADMIN', 'FUNCIONARIO']), petController.list);
router.get('/me', authorizeRole(['MORADOR']), petController.listMine);
router.post('/', authorizeRole(['MORADOR']), validate(createPetSchema), petController.create);
router.delete('/:id', authorizeRole(['ADMIN', 'MORADOR']), validate(idParamsSchema, 'params'), petController.delete);

export default router;
