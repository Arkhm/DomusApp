import { commonAreaRepository } from '../repositories/commonAreaRepository';
import { reservationRepository } from '../repositories/reservationRepository';
import { createReservationSchema, rejectReservationSchema, reservationQuerySchema, ReservationInput, ReservationQuery } from '../schemas/reservationSchema';
import { hasPanelAccess } from '../lib/access';
import { HttpError } from '../lib/httpError';

type Actor = { id: string; role: string; isSyndic?: boolean };
export const reservationClock = { now: () => new Date() };
const requireResident = (user: Actor) => {
  if (user.role !== 'MORADOR') throw new HttpError(403, 'Apenas moradores podem criar ou cancelar reservas.');
};
const requireApprover = (user: Actor) => {
  if (user.role !== 'ADMIN' && !(user.role === 'MORADOR' && user.isSyndic)) {
    throw new HttpError(403, 'Apenas administradores ou síndica podem avaliar reservas.');
  }
};
const requireFuture = (date: Date, startTime: string) => {
  if (new Date(`${date.toISOString().slice(0, 10)}T${startTime}:00-03:00`) <= reservationClock.now()) {
    throw new HttpError(400, 'O início da reserva já passou.');
  }
};
const findReservation = async (id: string) => {
  const reservation = await reservationRepository.findById(id);
  if (!reservation) throw new HttpError(404, 'Reserva não encontrada.');
  return reservation;
};

export const reservationService = {
  list: (user: Actor, input: ReservationQuery) => {
    const query = reservationQuerySchema.parse(input);
    return reservationRepository.findAll({
      ...(!hasPanelAccess(user) ? { userId: user.id } : {}),
      status: query.status, commonAreaId: query.commonAreaId,
      date: { gte: query.from ? new Date(`${query.from}T00:00:00.000Z`) : undefined,
        lte: query.to ? new Date(`${query.to}T00:00:00.000Z`) : undefined },
    });
  },
  create: async (user: Actor, input: ReservationInput) => {
    requireResident(user);
    const data = createReservationSchema.parse(input);
    const date = new Date(`${data.date}T00:00:00.000Z`);
    return commonAreaRepository.withLockedArea(data.commonAreaId, async tx => {
      const area = await commonAreaRepository.findById(data.commonAreaId, tx);
      if (!area) throw new HttpError(404, 'Área comum não encontrada.');
      if (!area.isActive) throw new HttpError(400, 'Área comum inativa.');
      requireFuture(date, data.startTime);
      if (await reservationRepository.hasCollision({ ...data, date }, tx)) {
        throw new HttpError(409, 'Horário colide com uma reserva aprovada.');
      }
      return reservationRepository.create({ ...data, date, userId: user.id, status: 'PENDING' }, tx);
    });
  },
  changeStatus: async (id: string, user: Actor, action: 'approve' | 'reject' | 'cancel', input: { reason?: string } = {}) => {
    if (action === 'cancel') requireResident(user);
    else requireApprover(user);
    const { reason } = rejectReservationSchema.parse(input);
    const initial = await findReservation(id);
    return commonAreaRepository.withLockedArea(initial.commonArea.id, async tx => {
      const reservation = await reservationRepository.findById(id, tx);
      if (!reservation) throw new HttpError(404, 'Reserva não encontrada.');
      if (action === 'cancel' && reservation.user.id !== user.id) throw new HttpError(403, 'Apenas o dono pode cancelar a reserva.');
      if (reservation.status !== 'PENDING' && !(action === 'cancel' && reservation.status === 'APPROVED')) {
        throw new HttpError(400, 'Situação da reserva não permite esta operação.');
      }
      if (action !== 'reject') requireFuture(reservation.date, reservation.startTime);
      if (action === 'approve' && await reservationRepository.hasCollision({
        commonAreaId: reservation.commonArea.id, date: reservation.date,
        startTime: reservation.startTime, endTime: reservation.endTime,
      }, tx)) throw new HttpError(409, 'Horário colide com uma reserva aprovada.');
      return reservationRepository.update(id, {
        status: action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'CANCELLED',
        ...(action === 'reject' ? { rejectionReason: reason ?? null } : {}),
      }, tx);
    });
  },
};
