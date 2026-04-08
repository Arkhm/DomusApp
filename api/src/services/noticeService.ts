import { noticeRepository } from '../repositories/noticeRepository';
import { userRepository } from '../repositories/userRepository';

export const noticeService = {
  async create(data: { title: string; content: string; targetType?: string; targetUnitId?: string; authorId: string }) {
    if (!data.title || !data.content) {
      throw new Error('Título e conteúdo são obrigatórios para criar um aviso.');
    }

    if (!data.targetType) {
      data.targetType = 'ALL';
    }

    return await noticeRepository.create(data);
  },

  async listForUser(userId: string, role: string) {
    // 1. ADM tem acesso ao findAll com todos os avisos
    if (role === 'ADMIN') {
      return await noticeRepository.findAll();
    }

    // 2. Se for outro tipo de usuário como um morador então o seu usuário dese ser consultado
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('Usuário não encontrado.');
    }

    // 3. Retorna os avisos direcionados a elee
    return await noticeRepository.findForUser(user.unitId);
  },

  async delete(id: string, userId: string, userRole: string) {
    const notice = await noticeRepository.findById(id);
    
    if (!notice) {
      throw new Error('Aviso não encontrado.');
    }

    if (notice.authorId !== userId && userRole !== 'ADMIN') {
      throw new Error('Você não tem permissão para apagar este aviso.');
    }

    await noticeRepository.delete(id);
    return { message: 'Aviso removido com sucesso.' };
  }
};