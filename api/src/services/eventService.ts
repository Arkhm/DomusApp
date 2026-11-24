import { unitRepository } from '../repositories/unitRepository';
import { HttpError } from '../lib/httpError';
import { updateEventSchema } from '../schemas/updateSchemas';
import { UpdateActor, requireEditor, isSyndic, hasPanelAccess } from '../lib/access';
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
  async update(id: string, input: unknown, actor: UpdateActor) {
    requireEditor(actor, isSyndic(actor));
    const data = updateEventSchema.parse(input);
    const record = await eventRepository.findById(id);
    if (!record) throw new HttpError(404, 'Registro não encontrado.');
    requireEditor(actor, isSyndic(actor) && record.authorId === actor.id);
    const targetType = data.targetType ?? record.targetType;
    const targetUnitId = data.targetUnitId !== undefined ? data.targetUnitId : record.targetUnitId;
    if (targetType === 'UNIT' && (!targetUnitId || !await unitRepository.findById(targetUnitId))) {
      throw new HttpError(400, 'Informe uma unidade existente para o destinatário.');
    }
    if (data.targetType !== undefined || data.targetUnitId !== undefined) {
      data.targetUnitId = targetType === 'ALL' ? null : targetUnitId;
    }
    return eventRepository.update(id, { ...data, eventDate: data.eventDate ? new Date(data.eventDate) : undefined });
  },

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
    if (data.capacity != null && (!Number.isInteger(data.capacity) || data.capacity < 1)) {
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

  async listForUser(userId: string, _role: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('Usuário não encontrado.');
    }

    // Todos os usuários do painel veem a programação completa, inclusive rascunhos.
    if (hasPanelAccess(user)) {
      return await eventRepository.findAll();
    }

    // Codepath dormente para morador comum (sem painel).
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
