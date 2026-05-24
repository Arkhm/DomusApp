import api from './api';
import type { LoginRequest, LoginResponse } from '../types/auth';
import type { User } from '../types/user';

export const authService = {
    async login(data: LoginRequest): Promise<LoginResponse> {
        const response = await api.post<LoginResponse>('/auth/login', data);
        return response.data;
    },

    saveAuth(token: string, user: User): void {
        localStorage.setItem('@domusapp:token', token);
        localStorage.setItem('@domusapp:user', JSON.stringify(user));
    },

    logout(): void {
        localStorage.removeItem('@domusapp:token');
        localStorage.removeItem('@domusapp:user');
    },

    getStoredToken(): string | null {
        return localStorage.getItem('@domusapp:token');
    },

    getStoredUser(): User | null {
        const user = localStorage.getItem('@domusapp:user');
        return user ? (JSON.parse(user) as User) : null;
    },
};
