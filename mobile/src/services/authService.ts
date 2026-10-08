import { api, usesCookieSession } from './api';
import type { LoginResponse, SessionProfile, User } from '../types';

/** Login: no navegador, a API cria a sessão em cookies httpOnly. */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
  return data;
}

/** Valida a sessão: web usa /auth/me; transporte nativo legado usa /users/me. */
export async function fetchSessionProfile(): Promise<SessionProfile> {
  if (usesCookieSession) return fetchCurrentUser();
  const { data } = await api.get<{ perfil: SessionProfile }>('/users/me');
  return data.perfil;
}

export async function fetchCurrentUser(): Promise<User> {
  const { data } = await api.get<{ user: User }>('/auth/me');
  return data.user;
}

export async function logout(): Promise<void> {
  if (usesCookieSession) await api.post('/auth/logout');
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

/** Web obtém perfil e unidade por /auth/me, sem acessar outros usuários. */
export async function withResolvedUnit(user: User): Promise<User> {
  if (usesCookieSession) return fetchCurrentUser();
  if (!user.unitId || user.unit) return user;
  try {
    const full = await fetchUserById(user.id);
    return { ...user, unit: full.unit ?? null };
  } catch {
    return user;
  }
}
