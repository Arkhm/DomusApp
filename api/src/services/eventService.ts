import { eventRepository } from '../repositories/eventRepository';
import { userRepository } from '../repositories/userRepository';

const VALID_STATUS = new Set(['DRAFT', 'PUBLISHED', 'CANCELLED']);
const VALID_CATEGORY = new Set([
  'ASSEMBLEIA',
  'CONFRATERNIZACAO',
  'MANUTENCAO',
  'REUNIAO',
  'OUTRO',
]);

export const eventService = {
  async create(data: {
    title: string;
    content: string;
    eventDate: string;
    location?: string;
    targetType?: string;
    targetUnitId?: string;
    authorId: string;
    category?: string;
    capacity?: number | null;
    status?: string;
  }) {
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

    if (data.category && !VALID_CATEGORY.has(data.category)) {
      throw new Error('Categoria inválida.');
    }
    if (data.status && !VALID_STATUS.has(data.status)) {
      throw new Error('Status inválido. Use DRAFT, PUBLISHED ou CANCELLED.');
    }
    if (data.capacity != null && (typeof data.capacity !== 'number' || data.capacity < 1)) {
      throw new Error('Capacidade deve ser um número inteiro maior que zero (ou ausente).');
    }

    if (!data.category) data.category = 'OUTRO';
    if (!data.status) data.status = 'PUBLISHED';
    if (data.capacity === undefined) data.capacity = null;

    return await eventRepository.create({
      ...data,
      eventDate: parsedDate,
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
