import { eventRepository } from '../repositories/eventRepository';
import { userRepository } from '../repositories/userRepository';

export const eventService = {
  async create(data: { title: string; content: string; eventDate: string; location?: string; targetType?: string; targetUnitId?: string; authorId: string }) {
    if (!data.title || !data.content || !data.eventDate) {
      throw new Error('Título, conteúdo e data do evento são obrigatórios.');
    }
    const parsedDate = new Date(data.eventDate);

    if (isNaN(parsedDate.getTime())) {
      throw new Error('Data do evento inválida.');
    }

    if (!data.targetType) {
      data.targetType = 'ALL';
    }

    return await eventRepository.create({
      ...data,
      eventDate: parsedDate
    });
  },

  async listForUser(userId: string, role: string) {
    if (role === 'ADMIN') {
      return await eventRepository.findAll();
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('Usuário não encontrado.');
    }

    return await eventRepository.findForUser(user.unitId);
  },

  async delete(id: string, userId: string, userRole: string) {
    const event = await eventRepository.findById(id);

    if (!event) {
      throw new Error('Evento não encontrado.');
    }

    if (event.authorId !== userId && userRole !== 'ADMIN') {
      throw new Error('Você não tem permissão para apagar este evento.');
    }

    await eventRepository.delete(id);
    return { message: 'Evento removido com sucesso.' };
  }
};