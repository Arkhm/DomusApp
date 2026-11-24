import { hasPanelAccess } from '../lib/access';
import { HttpError } from '../lib/httpError';
import { incidentRepository } from '../repositories/incidentRepository';
import { userRepository } from '../repositories/userRepository';
import { CreateIncidentInput, IncidentFilters, UpdateIncidentInput } from '../schemas/incidentSchema';

type Actor = { id: string; role: string; isSyndic?: boolean };

export const incidentService = {
  async list(user: Actor, filters: IncidentFilters) {
    return await incidentRepository.findAll({
      status: filters.status, category: filters.category,
      authorId: hasPanelAccess(user) ? undefined : user.id,
    });
  },

  async getById(id: string, user: Actor) {
    const incident = await incidentRepository.findById(id, hasPanelAccess(user) ? undefined : user.id);
    if (!incident) throw new HttpError(404, 'Ocorrência não encontrada.');
    return incident;
  },

  async create(data: CreateIncidentInput, userId: string) {
    const user = await userRepository.findById(userId);
    // A síndica também é moradora: registra ocorrências da própria unidade.
    if (!user || user.role !== 'MORADOR' || !user.unitId) {
      throw new HttpError(403, 'Apenas moradores com unidade podem registrar ocorrências.');
    }
    return await incidentRepository.create({
      title: data.title, description: data.description, category: data.category,
      authorId: user.id, unitId: user.unitId,
    });
  },

  async update(id: string, data: UpdateIncidentInput, user: Actor) {
    if (!hasPanelAccess(user)) throw new HttpError(403, 'Apenas a gestão pode atualizar ocorrências.');
    const incident = await incidentService.getById(id, user);
    if (incident.status === 'CLOSED') throw new HttpError(400, 'Ocorrência encerrada não pode ser alterada.');
    const updated = await incidentRepository.update(id, {
      status: data.status, response: data.response,
      respondedAt: data.response !== undefined ? new Date() : undefined,
    });
    if (!updated) throw new HttpError(400, 'Ocorrência encerrada não pode ser alterada.');
    return updated;
  },
};
