import { Router } from 'express';
import { votingController } from '../controllers/votingController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';

const router = Router();

router.use(authMiddleware);

// ADMIN e FUNCIONARIO podem listar as votações
router.get('/', authorizeRole(['ADMIN', 'FUNCIONARIO']), votingController.list);

// Apenas ADMIN pode criar ou apagar votações
router.post('/', authorizeRole(['ADMIN']), votingController.create);
router.delete('/:id', authorizeRole(['ADMIN']), votingController.delete);

export default router;
