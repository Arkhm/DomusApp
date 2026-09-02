import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';
import { loginLimiter } from '../middlewares/rateLimitMiddleware';

const router = Router();

// Rotas Públicas
router.post('/register', authController.register);
// `loginLimiter` corta força bruta: 10 tentativas falhas por IP a cada 15min
router.post('/login', loginLimiter, authController.login);

// Rotas Protegidas
// Criar novo Administrador
// 1. O authMiddleware verifica o token JWT e injeta o req.user
// 2. O authorizeRole verifica se o req.user.role é "ADMIN"
// 3. Só então o controlador é chamado
router.post(
  '/register-admin',
  authMiddleware,
  authorizeRole(['ADMIN']),
  authController.registerAdmin
);

export default router;
