/**
 * Tipos do domínio DomusApp.
 *
 * Espelham exatamente o que a API em `./api` devolve hoje (schema.prisma +
 * repositories). Campos marcados como opcionais são os que a API só envia em
 * alguns endpoints — não invente que eles sempre existem.
 */

export type UserRole = 'ADMIN' | 'FUNCIONARIO' | 'MORADOR';

export type UserStatus = 'ACTIVE' | 'INACTIVE';

export type UnitType = 'APARTMENT' | 'HOUSE';

export interface Unit {
  id: string;
  type: UnitType;
  /** APARTMENT: bloco/torre · HOUSE: quadra/setor. Pode ser nulo. */
  block: string | null;
  number: string;
  condominiumId: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  isSyndic: boolean;
  isCouncilMember: boolean;
  condominiumId: string;
  unitId: string | null;
  /**
   * A API só devolve a relação `unit` em `GET /users/:id` (restrito a
   * ADMIN/FUNCIONARIO). O `POST /auth/login` devolve apenas `unitId`.
   * Ver `userService.resolveUnit`.
   */
  unit?: Unit | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthorSummary {
  name: string;
  role: UserRole;
}

export type NoticeStatus = 'DRAFT' | 'PUBLISHED';
export type NoticePriority = 'NORMAL' | 'URGENT';
export type TargetType = 'ALL' | 'UNIT';

export interface Notice {
  id: string;
  title: string;
  content: string;
  targetType: TargetType;
  status: NoticeStatus;
  priority: NoticePriority;
  condominiumId: string;
  targetUnitId: string | null;
  targetUnit: Unit | null;
  authorId: string;
  author: AuthorSummary;
  createdAt: string;
  updatedAt: string;
  /** Presente apenas na visão de morador (`findForUser`). */
  isRead?: boolean;
  /** Presentes apenas na visão de painel (ADMIN/FUNCIONARIO/síndico). */
  readCount?: number;
  totalAddressees?: number;
}

export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED';
export type EventCategory =
  | 'ASSEMBLEIA'
  | 'CONFRATERNIZACAO'
  | 'MANUTENCAO'
  | 'REUNIAO'
  | 'OUTRO';

export interface CondoEvent {
  id: string;
  title: string;
  content: string;
  /** ISO 8601 vindo do Prisma/DateTime. */
  eventDate: string;
  location: string | null;
  targetType: TargetType;
  category: EventCategory;
  capacity: number | null;
  status: EventStatus;
  condominiumId: string;
  targetUnitId: string | null;
  targetUnit: Unit | null;
  authorId: string;
  author: AuthorSummary;
  createdAt: string;
  updatedAt: string;
}

/** Corpo de `POST /auth/login` em caso de sucesso (200). */
export interface LoginResponse {
  user: User;
  token: string;
}

/** Payload do JWT, devolvido por `GET /users/me` dentro de `perfil`. */
export interface SessionProfile {
  id: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}
