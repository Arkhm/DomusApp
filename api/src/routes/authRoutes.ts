import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';
import { loginLimiter } from '../middlewares/rateLimitMiddleware';
import { validate } from '../middlewares/validate';
import { loginSchema, registerSchema } from '../schemas/authSchema';

const router = Router();

// Rotas Públicas
router.post('/register', validate(registerSchema), authController.register);
// `loginLimiter` corta força bruta antes da validação de propósito: um body
// malformado ainda deve consumir cota (só login bem-sucedido é de graça).
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
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
  validate(registerSchema),
  authController.registerAdmin
);

export default router;
