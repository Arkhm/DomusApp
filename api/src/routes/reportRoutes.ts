import { Router } from 'express';
import { reportController } from '../controllers/reportController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validate';
import { reportPeriodSchema } from '../schemas/reportSchema';

const router = Router();
router.use(authMiddleware, authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']));
router.get('/occupancy', reportController.occupancy);
router.get('/charges-summary', validate(reportPeriodSchema, 'query'), reportController.chargesSummary);
router.get('/incidents', validate(reportPeriodSchema, 'query'), reportController.incidents);
router.get('/reservations', validate(reportPeriodSchema, 'query'), reportController.reservations);
export default router;
