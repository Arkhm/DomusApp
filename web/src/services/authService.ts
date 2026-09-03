import api from './api';
import type { LoginRequest, LoginResponse, SessionResponse } from '../types/auth';
import type { User } from '../types/user';

// Chave herdada da era do localStorage. Hoje guarda **apenas** o perfil (nome,
// role, unidade) para o primeiro frame não piscar a tela de login — o token
// não passa mais por aqui.
const USER_CACHE_KEY = '@domusapp:user';

export const authService = {
    async login(data: LoginRequest): Promise<LoginResponse> {
        const response = await api.post<LoginResponse>('/auth/login', data);
        return response.data;
    },

    // Reidrata a sessão no reload: quem valida o cookie httpOnly é a API.
    async me(): Promise<User> {
        const response = await api.get<SessionResponse>('/auth/me');
        return response.data.user;
    },

    // RF-007 — passo 1. A API responde 200 exista ou não a conta, de propósito:
    // uma resposta diferente por email inexistente entregaria quem tem cadastro.
    async forgotPassword(email: string): Promise<string> {
        const response = await api.post<{ message: string }>('/auth/forgot-password', { email });
        return response.data.message;
    },

    // RF-007 — passo 2. O token vem do link enviado por email.
    async resetPassword(token: string, password: string): Promise<string> {
        const response = await api.post<{ message: string }>('/auth/reset-password', {
            token,
            password,
        });
        return response.data.message;
    },

    async logout(): Promise<void> {
        try {
            // Cookies httpOnly não são apagáveis pelo JS — só a API consegue.
            await api.post('/auth/logout');
        } finally {
            localStorage.removeItem(USER_CACHE_KEY);
        }
    },

    cacheUser(user: User): void {
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    },

    clearCachedUser(): void {
        localStorage.removeItem(USER_CACHE_KEY);
    },

    getCachedUser(): User | null {
        const user = localStorage.getItem(USER_CACHE_KEY);
        if (!user) return null;
        try {
            return JSON.parse(user) as User;
        } catch {
            localStorage.removeItem(USER_CACHE_KEY);
            return null;
        }
    },
};
