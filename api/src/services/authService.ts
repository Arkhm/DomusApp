import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { userRepository } from '../repositories/userRepository';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("ERRO: JWT_SECRET não está definido no arquivo .env");
}

export const authService = {
  async register(data: any) {

  // REGRA 1 — campos obrigatórios
  if (!data.name || !data.email || !data.password) {
    throw new Error("Nome, email e senha são obrigatórios.");
  }

  const userExists = await userRepository.findByEmail(data.email);
  if (userExists) {
    throw new Error('E-mail já cadastrado.');
  }

  // REGRA 2 — registro público sempre cria morador
  data.role = "morador";

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const newUser = await userRepository.create({
    ...data,
    password: hashedPassword,
  });

  return newUser;
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

  const token = jwt.sign(
    { id: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  //  remover senha antes de retornar
  const { password: _, ...userWithoutPassword } = user;

  return { user: userWithoutPassword, token };
},

async createAdmin(data: any) {

  if (!data.name || !data.email || !data.password) {
    throw new Error("Nome, email e senha são obrigatórios.");
  }

  const userExists = await userRepository.findByEmail(data.email);
  if (userExists) {
    throw new Error('E-mail já cadastrado.');
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const newAdmin = await userRepository.create({
    ...data,
    password: hashedPassword,
    role: "admin",
  });

  return newAdmin;
}
};