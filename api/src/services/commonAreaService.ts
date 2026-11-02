import { commonAreaRepository } from '../repositories/commonAreaRepository';
import { createCommonAreaSchema, updateCommonAreaSchema, CommonAreaInput } from '../schemas/commonAreaSchema';
import { hasPanelAccess } from '../lib/access';
import { HttpError } from '../lib/httpError';
import { reservationClock } from './reservationService';

type Actor = { role: string; isSyndic?: boolean };
export const commonAreaService = {
  list: (user: Actor) => commonAreaRepository.findAll(hasPanelAccess(user)),
  create: (input: CommonAreaInput) => commonAreaRepository.create(createCommonAreaSchema.parse(input)),
  update: (id: string, input: Partial<CommonAreaInput>) => {
    const data = updateCommonAreaSchema.parse(input);
    return commonAreaRepository.withLockedArea(id, async tx => {
      if (!await commonAreaRepository.findById(id, tx)) throw new HttpError(404, 'Área comum não encontrada.');
      return commonAreaRepository.update(id, data, tx);
    });
  },
  delete: (id: string) => commonAreaRepository.withLockedArea(id, async tx => {
    if (!await commonAreaRepository.findById(id, tx)) throw new HttpError(404, 'Área comum não encontrada.');
    const day = new Date(reservationClock.now().getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (await commonAreaRepository.hasFutureReservations(id, new Date(`${day}T00:00:00.000Z`), tx)) {
      throw new HttpError(400, 'Há reservas pendentes ou aprovadas de hoje em diante; desative a área em vez de remover.');
    }
    await commonAreaRepository.delete(id, tx);
    return { message: 'Área comum removida com sucesso.' };
  }),
};
