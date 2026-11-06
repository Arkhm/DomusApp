import { updateVehicleSchema } from '../schemas/updateSchemas';
import { createVehicleSchema, vehicleQuerySchema } from '../schemas/vehicleSchema';
import { idParamsSchema } from '../schemas/common';
import { validate } from '../middlewares/validate';
import { Router } from 'express';
import { vehicleController } from '../controllers/vehicleController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', authorizeRole(['ADMIN', 'FUNCIONARIO']), validate(vehicleQuerySchema, 'query'), vehicleController.list);
router.get('/me', authorizeRole(['MORADOR']), vehicleController.listMine);
router.post('/', authorizeRole(['MORADOR']), validate(createVehicleSchema), vehicleController.create);
router.put('/:id', authorizeRole(['ADMIN']), validate(idParamsSchema, 'params'), validate(updateVehicleSchema), vehicleController.update);
router.delete('/:id', authorizeRole(['ADMIN', 'MORADOR']), validate(idParamsSchema, 'params'), vehicleController.delete);

export default router;
