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

/** Agrupa pela data do evento; cancelados continuam visíveis na sua seção. */
export function splitEvents(events: CondoEvent[], now: Date = new Date()): { upcoming: CondoEvent[]; past: CondoEvent[] } {
  const visible = events.filter((event) => event.status !== 'DRAFT' && Number.isFinite(Date.parse(event.eventDate)));
  return {
    upcoming: visible.filter((event) => Date.parse(event.eventDate) >= now.getTime())
      .sort((a, b) => Date.parse(a.eventDate) - Date.parse(b.eventDate)),
    past: visible.filter((event) => Date.parse(event.eventDate) < now.getTime())
      .sort((a, b) => Date.parse(b.eventDate) - Date.parse(a.eventDate)),
  };
}

const eventDateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

export function formatEventDateTime(event: CondoEvent): string {
  const date = new Date(event.eventDate);
  return Number.isNaN(date.getTime()) ? 'Data não informada' : `${eventDateTimeFormatter.format(date)} (horário de Brasília)`;
}
