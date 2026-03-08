import api from './api';
import type { LoginRequest, LoginResponse } from '../types/auth';

export const authService = {
    async login(data: LoginRequest): Promise<LoginResponse> {
        const response = await api.post<LoginResponse>('/auth/login', data);
        return response.data;
    },

    saveAuth(token: string, user: any): void {
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

    getStoredUser(): any | null {
        const user = localStorage.getItem('@domusapp:user');
        return user ? JSON.parse(user) : null;
    },
};
