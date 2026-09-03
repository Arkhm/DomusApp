import { Request, Response } from 'express';
import { authService } from '../services/authService';
import {
  REFRESH_COOKIE,
  clearAuthCookie,
  clearSessionCookies,
  setAuthCookie,
  setRefreshCookie,
} from '../lib/authCookie';
import { AuthRequest } from '../middlewares/authMiddleware';

// Os dois tokens vão **só** em cookies httpOnly. Devolvê-los no corpo permitiria
// que o front os guardasse em localStorage — exatamente o que queremos eliminar
// (localStorage é legível por qualquer XSS).
const startSession = (res: Response, tokens: { accessToken: string; refreshToken: string }) => {
  setAuthCookie(res, tokens.accessToken);
  setRefreshCookie(res, tokens.refreshToken);
};

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
      const { user, accessToken, refreshToken } = await authService.login(email, password);

      startSession(res, { accessToken, refreshToken });

      res.status(200).json({ user });
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  },

  /**
   * Renova a sessão a partir do cookie de refresh (válido por 7 dias).
   *
   * O front chama esta rota quando leva um 401 e repete a requisição original —
   * é o que faz o access token de 15 minutos passar despercebido pelo usuário.
   */
  async refresh(req: Request, res: Response) {
    try {
      const { user, accessToken, refreshToken } = await authService.refreshSession(
        req.cookies?.[REFRESH_COOKIE]
      );

      startSession(res, { accessToken, refreshToken });

      res.status(200).json({ user });
    } catch (error: any) {
      // Refresh recusado é fim de sessão: limpa os dois cookies para o browser
      // parar de reapresentar credenciais que a API já rejeitou.
      clearSessionCookies(res);
      res.status(401).json({ error: error.message });
    }
  },

  async logout(req: Request, res: Response) {
    // Como os cookies são httpOnly, o front não consegue apagá-los sozinho.
    clearSessionCookies(res);
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
  },

  /**
   * RF-007, passo 1 — POST /auth/forgot-password
   *
   * Responde 200 com a mesma mensagem exista ou não a conta. Diferenciar as
   * respostas entregaria uma lista de emails cadastrados para quem sondasse a
   * rota.
   */
  async forgotPassword(req: Request, res: Response) {
    try {
      await authService.requestPasswordReset(req.body.email);
    } catch (error: any) {
      // Falha interna também não pode vazar a existência da conta.
      console.error('[auth] Erro em forgot-password:', error);
    }

    res.status(200).json({
      message: 'Se este email estiver cadastrado, enviaremos um link de recuperação.',
    });
  },

  // RF-007, passo 2 — POST /auth/reset-password
  async resetPassword(req: Request, res: Response) {
    try {
      const { token, password } = req.body;
      const result = await authService.resetPassword(token, password);

      // A senha mudou: qualquer sessão aberta neste browser deixa de valer.
      clearSessionCookies(res);

      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
};
