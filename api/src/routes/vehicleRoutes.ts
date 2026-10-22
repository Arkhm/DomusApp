import { Router } from 'express';
import { vehicleController } from '../controllers/vehicleController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', authorizeRole(['ADMIN', 'FUNCIONARIO']), vehicleController.list);
router.get('/me', authorizeRole(['MORADOR']), vehicleController.listMine);
router.post('/', authorizeRole(['MORADOR']), vehicleController.create);
router.delete('/:id', authorizeRole(['ADMIN', 'MORADOR']), vehicleController.delete);

export default router;
