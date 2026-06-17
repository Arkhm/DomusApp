import { Router } from 'express';
import { unitController } from '../controllers/unitController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';

const router = Router();

router.use(authMiddleware);

// ADMIN e FUNCIONÁRIOS podem listar
router.get('/', authorizeRole(['ADMIN', 'FUNCIONARIO']), unitController.list);

// APENAS ADMIN pode criar ou deletar blocos/apartamentos
router.post('/', authorizeRole(['ADMIN']), unitController.create);
router.put('/:id', authorizeRole(['ADMIN']), unitController.update);
router.delete('/:id', authorizeRole(['ADMIN']), unitController.delete);

export default router;