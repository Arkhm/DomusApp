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
// Logout é público de propósito: derrubar o cookie precisa funcionar mesmo com
// token já expirado, senão a sessão morta ficaria presa no browser.
router.post('/logout', authController.logout);

// Rotas Protegidas
router.get('/me', authMiddleware, authController.me);

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
