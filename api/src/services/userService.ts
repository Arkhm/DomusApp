import bcrypt from 'bcryptjs';
import { userRepository } from '../repositories/userRepository';

export const userService = {
  async listAll() {
    return await userRepository.findAll();
  },

  async getById(id: number) {
    const user = await userRepository.findById(id);
    if (!user) throw new Error('Usuário não encontrado.');
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },

  async search(query: string) {
    return await userRepository.search(query);
  },

  async create(data: any) {
    if (!data.name || !data.email || !data.password || !data.role_id) {
      throw new Error('Nome, email, senha e role_id são obrigatórios.');
    }

    if (await userRepository.findByEmail(data.email)) {
      throw new Error('E-mail já cadastrado.');
    }

    data.password = await bcrypt.hash(data.password, 10);
    data.role_id = Number(data.role_id);
    if (data.unit_id) data.unit_id = Number(data.unit_id);
    else data.unit_id = null;

    const newUser = await userRepository.create(data);
    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  },

  async update(id: number, data: any) {
    const user = await userRepository.findById(id);
    if (!user) throw new Error('Usuário não encontrado.');

    if (data.email && data.email !== user.email) {
      if (await userRepository.findByEmail(data.email)) {
        throw new Error('E-mail já cadastrado por outro usuário.');
      }
    }

    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    } else {
      delete data.password;
    }

    if (data.role_id) data.role_id = Number(data.role_id);
    if (data.unit_id) data.unit_id = Number(data.unit_id);
    else if (data.unit_id === null || data.unit_id === '') data.unit_id = null;

    const updated = await userRepository.update(id, data);
    const { password, ...userWithoutPassword } = updated;
    return userWithoutPassword;
  },

  async delete(id: number) {
    const user = await userRepository.findById(id);
    if (!user) throw new Error('Usuário não encontrado.');
    await userRepository.delete(id);
    return { message: 'Usuário removido com sucesso.' };
  },
};