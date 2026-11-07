import { HttpError } from '../lib/httpError';
import bcrypt from 'bcryptjs';
import { createAuthTokens, verifyLogoutToken, verifyRefreshToken } from '../lib/authTokens';
import { userRepository } from '../repositories/userRepository';
import { generateResetToken, hashResetToken, RESET_TOKEN_TTL_MS } from '../lib/resetToken';
import { sendPasswordResetEmail } from '../lib/mailer';
import { sanitizeUser } from '../lib/sanitizeUser';

export const authService = {
  async refresh(refreshToken: string) {
    let payload: ReturnType<typeof verifyRefreshToken>;
    try { payload = verifyRefreshToken(refreshToken); }
    catch { throw new HttpError(401, 'Refresh token inválido.'); }
    const user = await userRepository.findById(payload.sub);
    if (!user || user.status !== 'ACTIVE' || user.tokenVersion !== payload.tokenVersion) {
      throw new HttpError(401, 'Refresh token inválido ou revogado.');
    }
    // shortcut: refresh reutilizavel ate expirar ou ate tokenVersion mudar, trocar por tabela de sessoes com deteccao de reuso se precisar revogar sessao individual.
    return createAuthTokens(user);
  },

  async logout(token?: string) {
    if (!token) return;
    let payload: ReturnType<typeof verifyLogoutToken>;
    try { payload = verifyLogoutToken(token); }
    catch { return; } // Invalid signatures or claims cannot identify a session to revoke.
    await userRepository.revokeTokens(payload.id, payload.tokenVersion);
  },

  async login(email: string, password: string) {
    if (!email || !password) {
      throw new Error("Email e senha são obrigatórios.");
    }

    const user = await userRepository.findByEmail(email);
    if (!user || user.status !== 'ACTIVE') {
      throw new Error('Credenciais inválidas.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Credenciais inválidas.');
    }

    const tokens = createAuthTokens(user);

    return { user: sanitizeUser(user), ...tokens };
  },

  // Consulta o cadastro atual da sessão; permissões são verificadas pelos recursos.
  async getAuthenticatedUser(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new HttpError(401, 'Sessão inválida.');
    }

    return sanitizeUser(user);
  },

  // RF-007. Silenciosa de propósito quando o e-mail não existe: o controller
  // sempre responde com a mesma mensagem genérica, então quem chama esta
  // função não vê diferença entre "e-mail não cadastrado" e "e-mail enviado"
  // — isso é o que impede alguém de usar o formulário pra descobrir quais
  // e-mails estão cadastrados no condomínio.
  async forgotPassword(email: string) {
    if (!email) {
      throw new Error('E-mail é obrigatório.');
    }

    const user = await userRepository.findByEmail(email);
    if (!user) return;

    const { token, tokenHash } = generateResetToken();
    await userRepository.update(user.id, {
      resetToken: tokenHash,
      resetTokenExpiry: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });

    // ALLOWED_ORIGIN já existe pra CORS (server.ts) — reaproveitado aqui como
    // a URL do front, em vez de criar uma variável de ambiente nova só pra
    // isso. Pega a primeira origem se houver mais de uma configurada.
    const frontendUrl = (process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173')
      .split(',')[0]
      .trim();
    const resetUrl = `${frontendUrl}/redefinir-senha?token=${token}`;

    await sendPasswordResetEmail(user.email, resetUrl);
  },

  // RF-007. `userRepository.update` é chamado direto (não `userService.update`)
  // de propósito: aquele método tem regras de negócio de cargo/CPF que não se
  // aplicam aqui, e re-hashearia uma senha que já chega hasheada.
  async resetPassword(token: string, newPassword: string) {
    if (!token || !newPassword) {
      throw new Error('Token e nova senha são obrigatórios.');
    }
    if (newPassword.length < 8) {
      throw new Error('Senha deve ter pelo menos 8 caracteres.');
    }

    const user = await userRepository.findByResetTokenHash(hashResetToken(token));

    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry.getTime() <= Date.now()) {
      throw new Error('Token inválido ou expirado.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    // Conditional update prevents two concurrent requests from consuming the same token.
    const consumed = await userRepository.consumeResetToken(user.id, hashResetToken(token), hashedPassword);
    if (!consumed) throw new Error('Token inválido ou expirado.');
  }
};