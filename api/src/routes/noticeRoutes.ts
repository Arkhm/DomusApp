    import { Router } from 'express';
    import { noticeController } from '../controllers/noticeController';
    import { authMiddleware } from '../middlewares/authMiddleware';
    import { authorizeRole } from '../middlewares/roleMiddleware';
    import { validate } from '../middlewares/validate';
    import { createNoticeSchema } from '../schemas/noticeSchema';

    const router = Router();

    router.use(authMiddleware);

    // Qualquer pessoa logada pode VER os avisos
    router.get('/', noticeController.list);

    // Qualquer pessoa logada pode marcar como lido (só registra para si)
    router.post('/:id/read', noticeController.markRead);

    // ADMIN e SYNDIC podem CRIAR ou DELETAR avisos
    router.post('/', authorizeRole(['ADMIN', 'SYNDIC']), validate(createNoticeSchema), noticeController.create);
    router.delete('/:id', authorizeRole(['ADMIN', 'SYNDIC']), noticeController.delete);

    export default router;