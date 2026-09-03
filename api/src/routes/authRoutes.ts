import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';
import { loginLimiter, passwordResetLimiter } from '../middlewares/rateLimitMiddleware';
import { validate } from '../middlewares/validate';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../schemas/authSchema';

const router = Router();

// Rotas Públicas
router.post('/register', validate(registerSchema), authController.register);
// `loginLimiter` corta força bruta: 10 tentativas falhas por IP a cada 15min
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
// Logout é público de propósito: derrubar os cookies precisa funcionar mesmo com
// token já expirado, senão a sessão morta ficaria presa no browser.
router.post('/logout', authController.logout);
// Renova o access token a partir do cookie de refresh. Pública porque, por
// definição, é chamada quando o access token já não vale mais.
router.post('/refresh', authController.refresh);

// RF-007 — recuperação de senha. As duas rotas dividem um limiter próprio para
// não virarem ferramenta de spam nem de adivinhação de token.
router.post(
  '/forgot-password',
  passwordResetLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);
router.post(
  '/reset-password',
  passwordResetLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword
);

// Rotas Protegidas
router.get('/me', authMiddleware, authController.me);

// Criar novo Administrador
// 1. O authMiddleware verifica o token JWT e injeta o req.user
// 2. O authorizeRole verifica se o req.user.role é "ADMIN"
// 3. O validate rejeita corpo malformado antes de chegar ao service
// 4. Só então o controlador é chamado
router.post(
  '/register-admin',
  authMiddleware,
  authorizeRole(['ADMIN']),
  validate(registerSchema),
  authController.registerAdmin
);

export default router;
