import type { CondoEvent, User } from '../types';

/** "Bom dia" / "Boa tarde" / "Boa noite" conforme o horário local. */
export function greetingFor(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Primeiro nome, para a saudação do header. */
export function firstName(fullName: string): string {
  const [first] = fullName.trim().split(/\s+/);
  return first ?? fullName;
}

/**
 * Rótulo da unidade do morador — "Bloco A · 101", "Quadra 1 · Casa 02".
 *
 * Devolve `null` quando a API não expôs a relação `unit` (o login só traz
 * `unitId`, e `GET /users/:id` é restrito a ADMIN/FUNCIONARIO).
 */
export function unitLabel(user: User | null): string | null {
  const unit = user?.unit;
  if (!unit) return null;

  const identifier = unit.type === 'HOUSE' ? `Casa ${unit.number}` : unit.number;
  return unit.block ? `${unit.block} · ${identifier}` : identifier;
}

/** Rótulo de papel usado quando não há unidade a exibir. */
export function roleLabel(user: User | null): string {
  if (!user) return '';
  if (user.role === 'ADMIN') return 'Administração';
  if (user.role === 'FUNCIONARIO') return 'Equipe do condomínio';
  if (user.isSyndic) return 'Síndica(o)';
  if (user.isCouncilMember) return 'Conselho';
  return 'Morador(a)';
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
});

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
});

/** "12 de set · 19:30" — vazio se a data vier inválida da API. */
export function formatEventDateTime(event: CondoEvent): string {
  const date = new Date(event.eventDate);
  if (Number.isNaN(date.getTime())) return '';
  return `${dateFormatter.format(date)} · ${timeFormatter.format(date)}`;
}

const shortDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
});

/**
 * Distância até o evento em linguagem natural, para caber no bloco de resumo.
 * Acima de um mês a contagem deixa de ajudar ("em 191 semanas"), então
 * mostramos a data curta.
 */
export function relativeDay(isoDate: string, now: Date = new Date()): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();

  const diffDays = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);

  if (diffDays < 0) return 'Já aconteceu';
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Amanhã';
  if (diffDays < 7) return `Em ${diffDays} dias`;
  if (diffDays < 14) return 'Em 1 semana';
  if (diffDays <= 30) return `Em ${Math.round(diffDays / 7)} semanas`;
  return shortDateFormatter.format(date);
}
