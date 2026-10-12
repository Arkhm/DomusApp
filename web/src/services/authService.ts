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

    async logout(): Promise<void> {
        try {
            // Cookie httpOnly não é apagável pelo JS — só a API consegue.
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
