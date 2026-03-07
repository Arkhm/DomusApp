import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middlewares/authMiddleware';

const router = Router();

// 'authMiddleware' vem ANTES do (req, res). 
router.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {

// Teste de acesso a uma rota protegida  
  res.status(200).json({
    message: 'Você acessou uma rota protegida!',
    seuPerfil: req.user
  });
});

export default router;