    import { Router } from 'express';
    import { noticeController } from '../controllers/noticeController';
    import { authMiddleware } from '../middlewares/authMiddleware';
    import { authorizeRole } from '../middlewares/roleMiddleware';
    import { validate } from '../middlewares/validate';
    import { createNoticeSchema } from '../schemas/noticeSchema';
    import { idParamSchema } from '../schemas/common';

    const router = Router();

    router.use(authMiddleware);

    // Qualquer pessoa logada pode VER os avisos
    router.get('/', noticeController.list);

    // Qualquer pessoa logada pode marcar como lido (só registra para si)
    router.post('/:id/read', validate(idParamSchema, 'params'), noticeController.markRead);

    // Apenas ADMIN pode CRIAR ou DELETAR avisos
    router.post('/', authorizeRole(['ADMIN']), validate(createNoticeSchema), noticeController.create);
    router.delete('/:id', authorizeRole(['ADMIN']), validate(idParamSchema, 'params'), noticeController.delete);

    export default router;