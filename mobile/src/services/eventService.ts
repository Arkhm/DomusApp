import { api } from './api';
import type { CondoEvent } from '../types';

/**
 * `GET /events` → `CondoEvent[]`, ordenados por `eventDate` ascendente.
 * Morador comum não recebe DRAFT.
 */
export async function listEvents(): Promise<CondoEvent[]> {
  const { data } = await api.get<CondoEvent[]>('/events');
  return data;
}

/** Próximo evento ainda não realizado e não cancelado. */
export function findNextEvent(events: CondoEvent[], now: Date = new Date()): CondoEvent | null {
  const upcoming = events
    .filter((event) => event.status !== 'CANCELLED' && event.status !== 'DRAFT')
    .filter((event) => {
      const date = new Date(event.eventDate);
      return !Number.isNaN(date.getTime()) && date.getTime() >= now.getTime();
    })
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());

  return upcoming[0] ?? null;
}
