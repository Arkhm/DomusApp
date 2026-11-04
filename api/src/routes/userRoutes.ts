import { idParamsSchema, searchQuerySchema } from '../schemas/common';
import { Router, Response } from 'express';
import { userController } from '../controllers/userController';
import { authMiddleware, AuthRequest } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validate';
import { createUserSchema, updateUserSchema } from '../schemas/userSchema';

const router = Router();

// Todas as rotas abaixo exigem que a pessoa esteja logada
router.use(authMiddleware);

// Tipamos o 'req' como 'AuthRequest' para o TypeScript reconhecer o req.user
router.get('/me', (req: AuthRequest, res: Response) => {
    res.status(200).json({ perfil: req.user });
});

// Apenas ADMIN e FUNCIONARIO podem listar e buscar todos os moradores
router.get('/', authorizeRole(['ADMIN', 'FUNCIONARIO']), validate(searchQuerySchema, 'query'), userController.list);
router.get('/:id', authorizeRole(['ADMIN', 'FUNCIONARIO']), validate(idParamsSchema, 'params'), userController.getById);

// Apenas ADMIN pode criar, editar ou apagar utilizadores pelo painel
router.post('/', authorizeRole(['ADMIN']), validate(createUserSchema), userController.create);
router.put('/:id', authorizeRole(['ADMIN']), validate(updateUserSchema), validate(idParamsSchema, 'params'), userController.update);
router.delete('/:id', authorizeRole(['ADMIN']), validate(idParamsSchema, 'params'), userController.delete);

export default router;
