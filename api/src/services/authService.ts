import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { userRepository } from '../repositories/userRepository';
import { hasPanelAccess } from '../lib/access';
import { mailer } from '../lib/mailer';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/tokens';

// RF-007 — o link de recuperação vale por 1 hora.
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

// O `iat` do JWT é em segundos truncados, enquanto `passwordChangedAt` tem
// milissegundos. Comparar os dois exige trazer a senha para a mesma escala —
// truncando para baixo, igual ao `iat`.
//
// Consequência conhecida: tokens emitidos no MESMO segundo do reset sobrevivem
// a ele. Fechar essa fresta exigiria um campo próprio com precisão de token
// (ou uma tabela de sessões); para o risco em questão — um refresh token
// roubado que valeria 7 dias — cair para 1 segundo já resolve.
const toEpochSeconds = (date: Date) => Math.floor(date.getTime() / 1000);

// Tipagem
interface RegisterDTO {
  name?: string;
  email?: string;
  password?: string;
}

// Guardamos no banco o SHA-256 do token, não o token. Quem vazar a tabela User
// leva apenas hashes — inúteis para trocar a senha de alguém. Não precisa de
// bcrypt aqui: o token tem 256 bits de entropia e vida de 1h, então não há o
// que "adivinhar" por força bruta como numa senha escolhida por humano.
const hashResetToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

const createUserLogic = async (data: RegisterDTO, assignedRole: string) => {
  if (!data.name || !data.email || !data.password) {
    throw new Error("Nome, email e senha são obrigatórios.");
  }

  const userExists = await userRepository.findByEmail(data.email);
  if (userExists) {
    throw new Error('E-mail já cadastrado.');
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const newUser = await userRepository.create({
    name: data.name,
    email: data.email,
    password: hashedPassword,
    role: assignedRole,
  });

  const { password: _, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
};

// Um par novo de tokens a cada login e a cada refresh.
//
// Vale registrar o que isto NÃO é: como os tokens são JWT sem estado no
// servidor, reemitir **não invalida** o refresh anterior — ele continua válido
// até vencer. Rotação com revogação de verdade exigiria guardar os tokens
// emitidos (tabela de sessões), o que está fora do escopo desta etapa. Hoje o
// único gatilho que derruba sessões abertas é o `passwordChangedAt`, checado
// em refreshSession.
const issueSession = (user: { id: string; role: string }) => ({
  accessToken: signAccessToken({ id: user.id, role: user.role }),
  refreshToken: signRefreshToken(user.id),
});

export const authService = {

  async register(data: RegisterDTO) {
    // Registro público sempre será MORADOR
    return await createUserLogic(data, "MORADOR");
  },

  async createAdmin(data: RegisterDTO) {
    // Rota específica para criar administrador
    return await createUserLogic(data, "ADMIN");
  },

  async login(email: string, password: string) {
    if (!email || !password) {
      throw new Error("Email e senha são obrigatórios.");
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error('Credenciais inválidas.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Credenciais inválidas.');
    }

    if (!hasPanelAccess(user)) {
      throw new Error('Sua conta não tem acesso ao painel administrativo.');
    }

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, ...issueSession(user) };
  },

  /**
   * Troca um refresh token válido por um par novo de tokens.
   *
   * É aqui que a sessão se renova sozinha: o access token dura 15 minutos, e
   * quando ele vence o front chama esta rota em vez de mandar o usuário para a
   * tela de login. Toda a revalidação cara (existe? tem acesso? trocou a senha?)
   * acontece neste ponto, não a cada requisição.
   */
  async refreshSession(refreshToken: string | undefined) {
    if (!refreshToken) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    let claims: { id: string; iat: number };
    try {
      claims = verifyRefreshToken(refreshToken);
    } catch {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    const user = await userRepository.findById(claims.id);
    if (!user) {
      throw new Error('Sessão inválida.');
    }

    // Uma troca de senha invalida os refresh tokens antigos. Sem esta checagem,
    // quem tivesse roubado um refresh token continuaria com acesso por até 7
    // dias mesmo depois de a vítima recuperar a conta pelo RF-007.
    if (user.passwordChangedAt && claims.iat < toEpochSeconds(user.passwordChangedAt)) {
      throw new Error('Sua senha foi alterada. Faça login novamente.');
    }

    if (!hasPanelAccess(user)) {
      throw new Error('Sua conta não tem acesso ao painel administrativo.');
    }

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, ...issueSession(user) };
  },

  // Reidrata a sessão a partir do id que veio no token do cookie. Revalida o
  // acesso no banco: um usuário revogado ou rebaixado depois da emissão do
  // token deixa de ser aceito antes de o cookie expirar.
  async getAuthenticatedUser(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('Sessão inválida.');
    }

    if (!hasPanelAccess(user)) {
      throw new Error('Sua conta não tem acesso ao painel administrativo.');
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },

  /**
   * RF-007, passo 1 — gera o token de recuperação e manda o link por email.
   *
   * Não devolve nada e não sinaliza se o email existe: responder "email não
   * cadastrado" transformaria a rota em um oráculo para descobrir quem tem
   * conta no condomínio. Do lado de fora, cadastrado e não cadastrado são
   * indistinguíveis.
   */
  async requestPasswordReset(email: string) {
    const user = await userRepository.findByEmail(email);
    if (!user) return;

    const rawToken = crypto.randomBytes(32).toString('hex');

    await userRepository.update(user.id, {
      resetToken: hashResetToken(rawToken),
      resetTokenExpiry: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });

    // Uma falha de SMTP não pode virar 500 na resposta: isso denunciaria que o
    // email existe (para quem não existe, nem chegamos a enviar nada).
    try {
      await mailer.sendPasswordReset(user.email, user.name, rawToken);
    } catch (error) {
      console.error('[auth] Falha ao enviar email de recuperação:', error);
    }
  },

  /**
   * RF-007, passo 2 — valida o token e grava a nova senha.
   */
  async resetPassword(token: string, newPassword: string) {
    const user = await userRepository.findByResetToken(hashResetToken(token));

    // Mesma mensagem para token inexistente e token vencido: não há por que
    // dizer a quem tenta qual dos dois casos ele acertou.
    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry.getTime() < Date.now()) {
      throw new Error('Token de recuperação inválido ou expirado.');
    }

    await userRepository.update(user.id, {
      password: await bcrypt.hash(newPassword, 10),
      // Token de uso único: consumido, some.
      resetToken: null,
      resetTokenExpiry: null,
      // Derruba as sessões abertas com a senha antiga (ver refreshSession).
      passwordChangedAt: new Date(),
    });

    return { message: 'Senha redefinida com sucesso. Faça login com a nova senha.' };
  }
};
