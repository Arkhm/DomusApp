import { Router } from 'express';
import { invoiceController } from '../controllers/invoiceController';
import { authMiddleware, AuthRequest } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';

const router = Router();

// Webhook público (deve vir ANTES do authMiddleware)
router.post('/webhook', invoiceController.webhook);

// Rotas protegidas
router.use(authMiddleware);

router.get('/stats', invoiceController.getUserStats);

router.get('/', invoiceController.listForUser);

router.post('/', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), invoiceController.create);

router.post('/batch', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), invoiceController.createBatch);

router.get('/unit/:unitId', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), invoiceController.listForUnit);

router.get('/unit/:unitId/stats', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), invoiceController.getUnitStats);

router.get('/all', authorizeRole(['ADMIN', 'FUNCIONARIO']), invoiceController.listAll);

router.get('/:id', invoiceController.getById);

router.put('/:id/status', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), invoiceController.updateStatus);

router.delete('/:id', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), invoiceController.cancel);

export default router;