import { noticeRepository } from '../repositories/noticeRepository';
import { userRepository } from '../repositories/userRepository';

const VALID_STATUS = new Set(['DRAFT', 'PUBLISHED']);
const VALID_PRIORITY = new Set(['NORMAL', 'URGENT']);

export const noticeService = {
  async create(data: {
    title: string;
    content: string;
    targetType?: string;
    targetUnitId?: string;
    authorId: string;
    status?: string;
    priority?: string;
  }) {
    if (!data.title || !data.content) {
      throw new Error('Título e conteúdo são obrigatórios para criar um aviso.');
    }

    if (!data.targetType) {
      data.targetType = 'ALL';
    }

    if (data.status && !VALID_STATUS.has(data.status)) {
      throw new Error('Status inválido. Use DRAFT ou PUBLISHED.');
    }
    if (data.priority && !VALID_PRIORITY.has(data.priority)) {
      throw new Error('Prioridade inválida. Use NORMAL ou URGENT.');
    }

    if (!data.status) data.status = 'PUBLISHED';
    if (!data.priority) data.priority = 'NORMAL';

    return await noticeRepository.create(data);
  },

  async listForUser(userId: string, role: string) {
    if (role === 'ADMIN') {
      const notices = await noticeRepository.findAll();
      // Anexa contagem de destinatários por aviso
      return await Promise.all(
        notices.map(async (n: any) => ({
          ...n,
          readCount: n._count?.readBy ?? 0,
          totalAddressees: await noticeRepository.countAddressees({
            targetType: n.targetType,
            targetUnitId: n.targetUnitId,
          }),
          _count: undefined,
        }))
      );
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('Usuário não encontrado.');
    }

    const notices = await noticeRepository.findForUser(userId, user.unitId);
    return notices.map((n: any) => {
      const isRead = Array.isArray(n.readBy) && n.readBy.length > 0;
      const { readBy, ...rest } = n;
      return { ...rest, isRead };
    });
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
  },

  async markAsRead(noticeId: string, userId: string) {
    const notice = await noticeRepository.findById(noticeId);
    if (!notice) {
      throw new Error('Aviso não encontrado.');
    }
    await noticeRepository.markAsRead(noticeId, userId);
    return { message: 'Marcado como lido.' };
  },
};
