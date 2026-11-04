import { Router } from 'express';
import { incidentController } from '../controllers/incidentController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validate';
import { idParamsSchema } from '../schemas/common';
import { createIncidentSchema, incidentQuerySchema, updateIncidentSchema } from '../schemas/incidentSchema';

const router = Router();
router.use(authMiddleware);

router.get('/', authorizeRole(['ADMIN', 'FUNCIONARIO', 'MORADOR']), validate(incidentQuerySchema, 'query'), incidentController.list);
router.get('/:id', authorizeRole(['ADMIN', 'FUNCIONARIO', 'MORADOR']), validate(idParamsSchema, 'params'), incidentController.getById);
router.post('/', authorizeRole(['MORADOR']), validate(createIncidentSchema), incidentController.create);
router.put('/:id', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), validate(idParamsSchema, 'params'), validate(updateIncidentSchema), incidentController.update);

export default router;
