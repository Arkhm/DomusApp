import { createInvoiceSchema, batchInvoiceSchema, invoiceQuerySchema, unitParamsSchema, invoiceReasonSchema, invoiceStatusSchema, webhookBodySchema, webhookQuerySchema } from '../schemas/invoiceSchema';
import { idParamsSchema } from '../schemas/common';
import { validate } from '../middlewares/validate';
import { Router } from 'express';
import { invoiceController } from '../controllers/invoiceController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';

const router = Router();

// Webhook público (deve vir ANTES do authMiddleware)
router.post('/webhook', validate(webhookBodySchema), validate(webhookQuerySchema, 'query'), invoiceController.webhook);

// Rotas protegidas
router.use(authMiddleware);

router.get('/stats', invoiceController.getUserStats);
router.get('/payments/health', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), invoiceController.health);

router.get('/', validate(invoiceQuerySchema, 'query'), invoiceController.listForUser);

router.post('/', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), validate(createInvoiceSchema), invoiceController.create);

router.post('/batch', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), validate(batchInvoiceSchema), invoiceController.createBatch);

router.get('/unit/:unitId', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), validate(invoiceQuerySchema, 'query'), validate(unitParamsSchema, 'params'), invoiceController.listForUnit);

router.get('/unit/:unitId/stats', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), validate(unitParamsSchema, 'params'), invoiceController.getUnitStats);

router.get('/all', authorizeRole(['ADMIN', 'FUNCIONARIO']), validate(invoiceQuerySchema, 'query'), invoiceController.listAll);

router.get('/:id', validate(idParamsSchema, 'params'), invoiceController.getById);
router.get('/:id/audit', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), validate(idParamsSchema, 'params'), invoiceController.audit);
router.post('/:id/reconcile', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), validate(idParamsSchema, 'params'), validate(invoiceReasonSchema), invoiceController.reconcile);
router.post('/:id/retry', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), validate(idParamsSchema, 'params'), validate(invoiceReasonSchema), invoiceController.retry);

router.put('/:id/status', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), validate(idParamsSchema, 'params'), validate(invoiceStatusSchema), invoiceController.updateStatus);

router.delete('/:id', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), validate(idParamsSchema, 'params'), validate(invoiceReasonSchema), invoiceController.cancel);

export default router;
