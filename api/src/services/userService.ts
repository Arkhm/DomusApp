import bcrypt from 'bcryptjs';
import { HttpError } from '../lib/httpError';
import { userRepository } from '../repositories/userRepository';
import { isValidCpf } from '../lib/cpf';
import { sanitizeUser } from '../lib/sanitizeUser';

export const userService = {
  async listAll() {
    return await userRepository.findAll();
  },

  async getById(id: string) {
    const user = await userRepository.findById(id);
    if (!user) throw new Error('Usuário não encontrado.');

    return sanitizeUser(user);
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
    return sanitizeUser(newUser);
  },

  async update(id: string, data: any) {
    const user = await userRepository.findById(id);
    if (!user) throw new Error('Usuário não encontrado.');

    if (data.email && data.email !== user.email) {
      if (await userRepository.findByEmail(data.email)) throw new Error('E-mail já cadastrado por outro.');
    }

    if (data.cpf && data.cpf !== user.cpf) {
      // O dígito verificador só é conferido quando o CPF muda de fato. O
      // schema Zod da edição valida só o formato (11 dígitos) — registros
      // antigos/seed podem ter CPF sem dígito verificador válido, e reenviar
      // o mesmo CPF em uma edição de outro campo não pode travar. Mesma regra
      // já aplicada no front (ver UserFormModal `cpfUnchanged`).
      if (!isValidCpf(data.cpf)) throw new Error('CPF inválido.');
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

    // RNE-003 vale para o estado final do usuário, não só para o body: um PUT
    // com apenas `{ unitId: null }` também tiraria o morador da unidade.
    const finalRole = data.role ?? user.role;
    const finalUnitId = data.unitId !== undefined ? data.unitId : user.unitId;
    if ((data.role !== undefined || data.unitId !== undefined) && finalRole === 'MORADOR' && !finalUnitId) {
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

    const sensitiveChange = !!data.password || ['role', 'status', 'isSyndic'].some(
      field => data[field] !== undefined && data[field] !== user[field as keyof typeof user],
    );
    if (sensitiveChange) data.tokenVersion = { increment: 1 };

    // Grava só se o tokenVersion ainda for o lido acima: uma alteração sensível
    // concorrente já o incrementou, e esta edição comparou contra dados velhos.
    const updatedUser = await userRepository.updateIfVersion(id, user.tokenVersion, data);
    if (!updatedUser) {
      throw new HttpError(409, 'O cadastro foi alterado por outra pessoa. Recarregue e tente novamente.');
    }
    return sanitizeUser(updatedUser);
  },

  async delete(id: string) {
    const user = await userRepository.findById(id);
    if (!user) throw new Error('Usuário não encontrado.');
    await userRepository.delete(id);
    return { message: 'Usuário removido com sucesso.' };
  },
};