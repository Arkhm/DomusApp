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

    // Camada de proteção para impedir inserçãoo de roles não permitidas
    const ALLOWED_ROLES = ['ADMIN', 'FUNCIONARIO', 'MORADOR'];

    if (data.role) {
          data.role = data.role.toUpperCase();
          if (!ALLOWED_ROLES.includes(data.role)) {
            throw new Error(`Cargo inválido. Use apenas: ${ALLOWED_ROLES.join(', ')}`);
          }
        } else {
          data.role = 'MORADOR';
        }
    // Para que um morador não seja criado sem uma unidade
    if (data.role === 'MORADOR' && !data.unitId) {
      throw new Error('É obrigatório informar a unidade (unitId) para cadastrar um morador.');
    }

    if (data.role !== 'MORADOR') {
      data.unitId = null;
      data.isSyndic = false;
      data.isCouncilMember = false;
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

    // Camada de proteção para impedir inserçãoo de roles não permitidas
    const ALLOWED_ROLES = ['ADMIN', 'FUNCIONARIO', 'MORADOR'];

    if (data.role) {
      data.role = data.role.toUpperCase();
      if (!ALLOWED_ROLES.includes(data.role)) {
        throw new Error(`Cargo inválido. Use apenas: ${ALLOWED_ROLES.join(', ')}`);
      }
    }

    if (data.role === 'MORADOR' && data.unitId === null) {
        throw new Error('Um morador não pode ficar sem unidade.');
    }

    if (data.role && data.role !== 'MORADOR') {
      data.unitId = null;
      data.isSyndic = false;
      data.isCouncilMember = false;
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