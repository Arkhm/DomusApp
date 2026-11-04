import { logger } from '../lib/logger';
import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { clearAuthCookie, setAuthCookie, clearRefreshCookie, setRefreshCookie, REFRESH_COOKIE } from '../lib/authCookie';
import { AuthRequest, extractToken } from '../middlewares/authMiddleware';

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
      const { user, token, refreshToken } = await authService.login(email, password);

      // Web usa apenas cookies httpOnly; mobile recebe o par para o SecureStore.
      setAuthCookie(res, token);
      setRefreshCookie(res, refreshToken);

      res.status(200).json(req.body.client === 'mobile' ? { user, token, refreshToken } : { user });
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  },

  async logout(req: Request, res: Response) {
    try {
      await authService.logout(extractToken(req));
      clearAuthCookie(res);
      clearRefreshCookie(res);
      res.status(200).json({ message: 'Sessão encerrada.' });
    } catch {
      clearAuthCookie(res);
      clearRefreshCookie(res);
      res.status(503).json({ error: 'Não foi possível revogar a sessão. Tente novamente.' });
    }
  },

  async refresh(req: Request, res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
    try {
      if (typeof refreshToken !== 'string' || !refreshToken) throw new Error('Refresh ausente.');
      const tokens = await authService.refresh(refreshToken);
      setAuthCookie(res, tokens.token);
      setRefreshCookie(res, tokens.refreshToken);
      res.status(200).json(req.body?.client === 'mobile' ? tokens : { message: 'Sessão renovada.' });
    } catch {
      clearAuthCookie(res);
      clearRefreshCookie(res);
      res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }
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

  // RF-007. A resposta é **sempre** a mesma, exista ou não o e-mail — só
  // assim o formulário não vira uma forma de descobrir quem está cadastrado.
  // Uma falha inesperada (SMTP fora do ar, etc.) fica só no log do servidor:
  // não é motivo pra travar o fluxo nem pra vazar detalhe pro cliente.
  async forgotPassword(req: Request, res: Response) {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'E-mail é obrigatório.' });
      return;
    }

    // Respond before database/SMTP work so delivery latency cannot reveal account existence.
    void authService.forgotPassword(email).catch(() => {
      logger.error({ code: 'PASSWORD_RESET_FAILED' }, 'Falha ao processar recuperação de senha.');
    });

    res.status(200).json({
      message: 'Se o e-mail existir em nossa base, você receberá as instruções de redefinição.',
    });
  },

  async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;
      await authService.resetPassword(token, newPassword);
      res.status(200).json({ message: 'Senha redefinida com sucesso.' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
};
