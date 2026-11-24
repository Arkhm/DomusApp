import { api } from './api';
import type { Reservation, ReservationInput } from '../types';

export async function listReservations(): Promise<Reservation[]> {
  const { data } = await api.get<Reservation[]>('/reservations');
  return data;
}

export async function createReservation(input: ReservationInput): Promise<Reservation> {
  const { commonAreaId, date, startTime, endTime } = input;
  const { data } = await api.post<Reservation>('/reservations', {
    commonAreaId, date, startTime, endTime,
  });
  return data;
}

export async function cancelReservation(id: string): Promise<Reservation> {
  const { data } = await api.delete<Reservation>(`/reservations/${encodeURIComponent(id)}`);
  return data;
}
