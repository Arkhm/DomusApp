import api from './api';
import { mockUserService } from './mockData';
import type { User, UserFormData } from '../types/user';

const isMockMode = import.meta.env.VITE_MOCK_MODE === 'true';

const realUserService = {
    async getAll(): Promise<User[]> {
        const response = await api.get<User[]>('/users');
        return response.data;
    },

    async getById(id: string): Promise<User> {
        const response = await api.get<User>(`/users/${id}`);
        return response.data;
    },

    async search(query: string): Promise<User[]> {
        const response = await api.get<User[]>(`/users?search=${encodeURIComponent(query)}`);
        return response.data;
    },

    async create(data: UserFormData): Promise<User> {
        const response = await api.post<User>('/users', data);
        return response.data;
    },

    async update(id: string, data: Partial<UserFormData>): Promise<User> {
        const response = await api.put<User>(`/users/${id}`, data);
        return response.data;
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/users/${id}`);
    },
};

export const userService = isMockMode ? mockUserService : realUserService;
