import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { userRepository } from '../repositories/userRepository';
import { hasPanelAccess } from '../lib/access';

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

  const { password: _, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
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

    if (!hasPanelAccess(user)) {
      throw new Error('Sua conta não tem acesso ao painel administrativo.');
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
  }
};