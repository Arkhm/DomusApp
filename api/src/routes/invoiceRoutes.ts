import { Router } from 'express';
import { invoiceController } from '../controllers/invoiceController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';

const router = Router();

// Webhook público (deve vir ANTES do authMiddleware)
router.post('/webhook', invoiceController.webhook);

// Rotas protegidas
router.use(authMiddleware);

router.get('/stats', invoiceController.getUserStats);
router.get('/payments/health', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), invoiceController.health);

router.get('/', invoiceController.listForUser);

router.post('/', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), invoiceController.create);

router.post('/batch', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), invoiceController.createBatch);

router.get('/unit/:unitId', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), invoiceController.listForUnit);

router.get('/unit/:unitId/stats', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), invoiceController.getUnitStats);

router.get('/all', authorizeRole(['ADMIN', 'FUNCIONARIO']), invoiceController.listAll);

router.get('/:id', invoiceController.getById);
router.get('/:id/audit', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), invoiceController.audit);
router.post('/:id/reconcile', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), invoiceController.reconcile);
router.post('/:id/retry', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), invoiceController.retry);

router.put('/:id/status', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), invoiceController.updateStatus);

router.delete('/:id', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), invoiceController.cancel);

export default router;
