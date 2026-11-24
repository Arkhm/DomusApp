import type { Reservation, ReservationInput } from '../types';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const CATEGORIES = ['BARULHO', 'MANUTENCAO', 'SEGURANCA', 'LIMPEZA', 'OUTRO'];

// A API guarda o dia em UTC, mas interpreta o início em Brasília (UTC-03 fixo).
function startTimestamp(date: string, time: string): number {
  return Date.parse(`${date.slice(0, 10)}T${time}:00-03:00`);
}

export function validateReservation(input: ReservationInput, now = Date.now()): string | null {
  if (!input.commonAreaId) return 'Escolha uma área comum ativa.';
  const day = new Date(`${input.date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(day.getTime()) ||
      day.toISOString().slice(0, 10) !== input.date) {
    return 'Informe uma data válida no formato YYYY-MM-DD.';
  }
  if (!TIME_PATTERN.test(input.startTime) || !TIME_PATTERN.test(input.endTime)) {
    return 'Informe os horários no formato HH:mm, de 00:00 a 23:59.';
  }
  if (input.startTime >= input.endTime) return 'O fim deve ser depois do início.';
  if (startTimestamp(input.date, input.startTime) <= now) {
    return 'O início da reserva deve estar no futuro (horário de Brasília).';
  }
  return null;
}

export function canCancelReservation(
  reservation: Reservation, userId: string, now = Date.now(),
): boolean {
  return reservation.user.id === userId &&
    (reservation.status === 'PENDING' || reservation.status === 'APPROVED') &&
    startTimestamp(reservation.date, reservation.startTime) > now;
}

export function formatReservationDate(date: string): string {
  return date.slice(0, 10).split('-').reverse().join('/');
}

export function validateIncident(input: {
  title: string; description: string; category: string;
}): string | null {
  if (!input.title.trim() || input.title.trim().length > 200) {
    return 'Informe um título com até 200 caracteres.';
  }
  if (!input.description.trim()) return 'Descreva a ocorrência.';
  if (!CATEGORIES.includes(input.category)) return 'Escolha uma categoria válida.';
  return null;
}
