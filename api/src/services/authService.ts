import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { userRepository } from '../repositories/userRepository';
import { hasPanelAccess } from '../lib/access';
import { generateResetToken, hashResetToken, RESET_TOKEN_TTL_MS } from '../lib/resetToken';
import { sendPasswordResetEmail } from '../lib/mailer';
import { sanitizeUser } from '../lib/sanitizeUser';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("ERRO: JWT_SECRET não está definido no arquivo .env");
}

// Tipagem
interface RegisterDTO {
  name?: string;
  email?: string;
  password?: string;
}

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

  return sanitizeUser(newUser);
};

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

    // Essa condição bloqueia o login com usuário MORADOR sem ter isSyndic, vou deixar o lib/access ocioso pelo menos por agora, não precisamos dele.
    // if (!hasPanelAccess(user)) {
    //   throw new Error('Sua conta não tem acesso ao painel administrativo.');
    // }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        isSyndic: user.isSyndic
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return { user: sanitizeUser(user), token };
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

    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry.getTime() < Date.now()) {
      throw new Error('Token inválido ou expirado.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await userRepository.update(user.id, {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    });
  }
};