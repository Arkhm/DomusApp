import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { clearAuthCookie, setAuthCookie } from '../lib/authCookie';
import { AuthRequest } from '../middlewares/authMiddleware';

export const authController = {
  async register(req: Request, res: Response) {
    try {
      const user = await authService.register(req.body);
      res.status(201).json(user);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async registerAdmin(req: Request, res: Response) {
    try {
      const admin = await authService.createAdmin(req.body);
      res.status(201).json(admin);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const { user, token } = await authService.login(email, password);

      // O token vai **só** no cookie httpOnly. Devolvê-lo no corpo permitiria
      // que o front o guardasse em localStorage — exatamente o que queremos
      // eliminar (localStorage é legível por qualquer XSS).
      setAuthCookie(res, token);

      res.status(200).json({ user });
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  },

  async logout(req: Request, res: Response) {
    // Como o cookie é httpOnly, o front não consegue apagá-lo sozinho.
    clearAuthCookie(res);
    res.status(200).json({ message: 'Sessão encerrada.' });
  },

  // Usado pelo front para reidratar a sessão em um reload: o token não é mais
  // legível no browser, então quem responde "quem sou eu" é a API.
  async me(req: AuthRequest, res: Response) {
    try {
      const user = await authService.getAuthenticatedUser(req.user!.id);
      res.status(200).json({ user });
    } catch (error: any) {
      clearAuthCookie(res);
      res.status(401).json({ error: error.message });
    }
  }
};
