import { Router } from 'express';
import { reservationController } from '../controllers/reservationController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validate';
import { idParamsSchema } from '../schemas/common';
import { createReservationSchema, rejectReservationSchema, reservationQuerySchema } from '../schemas/reservationSchema';

const router = Router();
router.use(authMiddleware);
router.get('/', validate(reservationQuerySchema, 'query'), reservationController.list);
router.post('/', authorizeRole(['MORADOR']), validate(createReservationSchema), reservationController.create);
router.put('/:id/approve', authorizeRole(['ADMIN', 'SYNDIC']), validate(idParamsSchema, 'params'), reservationController.approve);
router.put('/:id/reject', authorizeRole(['ADMIN', 'SYNDIC']), validate(idParamsSchema, 'params'), validate(rejectReservationSchema), reservationController.reject);
router.delete('/:id', authorizeRole(['MORADOR']), validate(idParamsSchema, 'params'), reservationController.cancel);
export default router;
