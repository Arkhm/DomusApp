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
  /** Relação disponível no perfil atualizado de GET /auth/me. */
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
  refreshToken: string;
}

export interface CommonArea {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  rules: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ReservationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export interface ReservationInput {
  commonAreaId: string;
  date: string;
  startTime: string;
  endTime: string;
}
export interface Reservation {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
  rejectionReason: string | null;
  createdAt: string;
  commonArea: Pick<CommonArea, 'id' | 'name'>;
  user: { id: string; name: string; unit: Pick<Unit, 'id' | 'block' | 'number'> | null };
}

export type IncidentCategory = 'BARULHO' | 'MANUTENCAO' | 'SEGURANCA' | 'LIMPEZA' | 'OUTRO';
export type IncidentStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export interface IncidentInput {
  title: string;
  description: string;
  category: IncidentCategory;
}
export interface Incident {
  id: string;
  title: string;
  description: string;
  category: IncidentCategory;
  status: IncidentStatus;
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string };
  unit: Pick<Unit, 'id' | 'block' | 'number'> | null;
}
