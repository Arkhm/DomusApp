import { Router } from 'express';
import { parkingSpotController } from '../controllers/parkingSpotController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validate';
import { idParamsSchema } from '../schemas/common';
import { createParkingSpotSchema, updateParkingSpotSchema, assignParkingSpotSchema, parkingSpotQuerySchema } from '../schemas/parkingSpotSchema';

const router = Router();
router.use(authMiddleware);
router.get('/me', authorizeRole(['MORADOR']), parkingSpotController.listMine);
router.use(authorizeRole(['ADMIN', 'FUNCIONARIO']));
router.get('/', validate(parkingSpotQuerySchema, 'query'), parkingSpotController.list);
router.post('/', validate(createParkingSpotSchema), parkingSpotController.create);
router.put('/:id/assign', validate(idParamsSchema, 'params'), validate(assignParkingSpotSchema), parkingSpotController.assign);
router.put('/:id', validate(idParamsSchema, 'params'), validate(updateParkingSpotSchema), parkingSpotController.update);
router.delete('/:id', validate(idParamsSchema, 'params'), parkingSpotController.delete);
export default router;
