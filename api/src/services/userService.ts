import bcrypt from 'bcryptjs';
import { userRepository } from '../repositories/userRepository';

export const userService = {
  async listAll() {
    return await userRepository.findAll();
  },

  async getById(id: string) {
    const user = await userRepository.findById(id);
    if (!user) throw new Error('Usuário não encontrado.');
    
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },

  async search(query: string) {
    return await userRepository.search(query);
  },

  async create(data: any) {
    if (!data.name || !data.email || !data.cpf || !data.password) {
      throw new Error('Nome, email, CPF e senha são obrigatórios.');
    }

    if (await userRepository.findByEmail(data.email)) throw new Error('E-mail já cadastrado.');
    if (await userRepository.findByCpf(data.cpf)) throw new Error('CPF já cadastrado.');

    // TRADUÇÃO FRONT -> BACK: Pega o "perfil" do front, converte para a "role" do back
    if (data.perfil) {
      const perfilFormatado = data.perfil.toUpperCase();
      if (perfilFormatado === 'ADMINISTRADOR') data.role = 'ADMIN';
      else if (perfilFormatado === 'FUNCIONARIO') data.role = 'FUNCIONARIO';
      else data.role = 'MORADOR';
      
      delete data.perfil; // Remove para o Prisma não dar erro
    } else {
      data.role = 'MORADOR';
    }

    if (data.role !== 'MORADOR') {
      data.unidade = null;
      data.is_sindico = false;
      data.is_conselheiro = false;
    }

    data.password = await bcrypt.hash(data.password, 10);

    const newUser = await userRepository.create(data);
    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  },

  async update(id: string, data: any) {
    const user = await userRepository.findById(id);
    if (!user) throw new Error('Usuário não encontrado.');

    if (data.email && data.email !== user.email) {
      if (await userRepository.findByEmail(data.email)) throw new Error('E-mail já cadastrado por outro.');
    }

    if (data.cpf && data.cpf !== user.cpf) {
      if (await userRepository.findByCpf(data.cpf)) throw new Error('CPF já cadastrado por outro.');
    }

    // TRADUÇÃO NO UPDATE
    if (data.perfil) {
      const perfilFormatado = data.perfil.toUpperCase();
      if (perfilFormatado === 'ADMINISTRADOR') data.role = 'ADMIN';
      else if (perfilFormatado === 'FUNCIONARIO') data.role = 'FUNCIONARIO';
      else data.role = 'MORADOR';
      
      delete data.perfil;
    }

    // Limpa campos se mudar a role no update
    if (data.role && data.role !== 'MORADOR') {
      data.unidade = null;
      data.is_sindico = false;
      data.is_conselheiro = false;
    }

    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    } else {
      delete data.password;
    }

    const updatedUser = await userRepository.update(id, data);
    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  },

  async delete(id: string) {
    const user = await userRepository.findById(id);
    if (!user) throw new Error('Usuário não encontrado.');
    await userRepository.delete(id);
    return { message: 'Usuário removido com sucesso.' };
  },
};