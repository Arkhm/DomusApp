import { Router } from 'express';
import { noticeController } from '../controllers/noticeController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';

const router = Router();

router.use(authMiddleware);

// Qualquer pessoa logada pode VER os avisos
router.get('/', noticeController.list);

// Apenas ADMIN pode CRIAR ou DELETAR avisos
router.post('/', authorizeRole(['ADMIN']), noticeController.create);
router.delete('/:id', authorizeRole(['ADMIN']), noticeController.delete);

export default router;