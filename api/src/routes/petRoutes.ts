import { Router } from 'express';
import { petController } from '../controllers/petController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', authorizeRole(['ADMIN', 'FUNCIONARIO']), petController.list);
router.get('/me', authorizeRole(['MORADOR']), petController.listMine);
router.post('/', authorizeRole(['MORADOR']), petController.create);
router.delete('/:id', authorizeRole(['ADMIN', 'MORADOR']), petController.delete);

export default router;