import { idParamsSchema } from '../schemas/common';
import { Router } from 'express';
import { unitController } from '../controllers/unitController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validate';
import { createUnitSchema, updateUnitSchema } from '../schemas/unitSchema';

const router = Router();

router.use(authMiddleware);

// ADMIN e FUNCIONÁRIOS podem listar
router.get('/', authorizeRole(['ADMIN', 'FUNCIONARIO']), unitController.list);

// APENAS ADMIN pode criar ou deletar blocos/apartamentos
router.post('/', authorizeRole(['ADMIN']), validate(createUnitSchema), unitController.create);
router.put('/:id', authorizeRole(['ADMIN']), validate(updateUnitSchema), validate(idParamsSchema, 'params'), unitController.update);
router.delete('/:id', authorizeRole(['ADMIN']), validate(idParamsSchema, 'params'), unitController.delete);

export default router;
