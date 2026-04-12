import { Router } from 'express';
import { unitController } from '../controllers/unitController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', authorizeRole(['ADMIN', 'FUNCIONARIO']), unitController.list);
router.get('/:id', authorizeRole(['ADMIN', 'FUNCIONARIO']), unitController.getById);

router.post('/', authorizeRole(['ADMIN']), unitController.create);
router.put('/:id', authorizeRole(['ADMIN']), unitController.update);
router.delete('/:id', authorizeRole(['ADMIN']), unitController.delete);

export default router;