import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { forgotPasswordLimiter, loginLimiter, sessionLimiter } from '../middlewares/rateLimitMiddleware';
import { validate } from '../middlewares/validate';
import { loginSchema, forgotPasswordSchema, resetPasswordSchema, refreshSchema } from '../schemas/authSchema';

const router = Router();

// Rotas Públicas
// `loginLimiter` corta força bruta antes da validação de propósito: um body
// malformado ainda deve consumir cota (só login bem-sucedido é de graça).
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
// Logout é público de propósito: derrubar o cookie precisa funcionar mesmo com
// token já expirado, senão a sessão morta ficaria presa no browser.
router.post('/logout', authController.logout);
router.post('/refresh', sessionLimiter, validate(refreshSchema), authController.refresh);

// RF-007 — recuperação de senha.
router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', sessionLimiter, validate(resetPasswordSchema), authController.resetPassword);

// Rotas Protegidas
router.get('/me', authMiddleware, authController.me);

export default router;
