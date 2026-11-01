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
router.put('/:id', authorizeRole(['ADMIN']), validate(updateUnitSchema), unitController.update);
router.delete('/:id', authorizeRole(['ADMIN']), unitController.delete);

export default router;