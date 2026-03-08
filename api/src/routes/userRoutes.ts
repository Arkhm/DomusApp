import { Router, Response } from 'express';
import { userController } from '../controllers/userController';
import { authMiddleware, AuthRequest } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';

const router = Router();

// Todas as rotas abaixo exigem que a pessoa esteja logada
router.use(authMiddleware);

// Tipamos o 'req' como 'AuthRequest' para o TypeScript reconhecer o req.user
router.get('/me', (req: AuthRequest, res: Response) => {
    res.status(200).json({ perfil: req.user });
});

// Apenas ADMIN e FUNCIONARIO podem listar e buscar todos os moradores
router.get('/', authorizeRole(['ADMIN', 'FUNCIONARIO']), userController.list);
router.get('/:id', authorizeRole(['ADMIN', 'FUNCIONARIO']), userController.getById);

// Apenas ADMIN pode criar, editar ou apagar utilizadores pelo painel
router.post('/', authorizeRole(['ADMIN']), userController.create);
router.put('/:id', authorizeRole(['ADMIN']), userController.update);
router.delete('/:id', authorizeRole(['ADMIN']), userController.delete);

export default router;