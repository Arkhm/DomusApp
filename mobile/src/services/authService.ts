import { api } from './api';
import type { LoginResponse, SessionProfile, User } from '../types';

/**
 * `POST /auth/login`
 *
 * 200 → `{ user, token }` (user sem `password`, sem a relação `unit`)
 * 401 → `{ error: string }`
 *
 * ⚠️ Hoje o `authService.login` da API barra MORADOR comum via
 * `hasPanelAccess` (api/src/lib/access.ts): só ADMIN, FUNCIONARIO e a síndica
 * (`isSyndic: true`) conseguem autenticar. Ver TODO no README do mobile.
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
  return data;
}

/**
 * `GET /users/me` → `{ perfil: <payload do JWT> }`.
 *
 * Só devolve `id` e `role` — não traz nome, unidade nem condomínio. Serve
 * apenas para validar que o token guardado ainda é aceito pela API.
 */
export async function fetchSessionProfile(): Promise<SessionProfile> {
  const { data } = await api.get<{ perfil: SessionProfile }>('/users/me');
  return data.perfil;
}

/**
 * `GET /users/:id` → usuário completo, com a relação `unit`.
 *
 * Restrito a ADMIN/FUNCIONARIO no `roleMiddleware`; para os demais responde
 * 403 e a chamada deve ser tratada como "unidade indisponível".
 */
export async function fetchUserById(id: string): Promise<User> {
  const { data } = await api.get<User>(`/users/${id}`);
  return data;
}

/**
 * Tenta completar o usuário do login com a relação `unit`.
 * Nunca lança: se a API negar (403) ou estiver fora, devolve o usuário original.
 */
export async function withResolvedUnit(user: User): Promise<User> {
  if (!user.unitId || user.unit) return user;
  try {
    const full = await fetchUserById(user.id);
    return { ...user, unit: full.unit ?? null };
  } catch {
    return user;
  }
}
