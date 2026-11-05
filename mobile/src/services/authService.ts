import { api } from './api';
import type { LoginResponse, User } from '../types';

/** Login mobile recebe o perfil e o par de tokens para o SecureStore. */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password, client: 'mobile' });
  return data;
}

/** Perfil atual, com unidade, do próprio usuário autenticado. */
export async function fetchSessionProfile(): Promise<User> {
  const { data } = await api.get<{ user: User }>('/auth/me');
  return data.user;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}
