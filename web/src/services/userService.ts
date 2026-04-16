import api from './api';
import { mockUserService } from './mockData';
import { mapUserFromApi, mapUserToApi } from '../types/user';
import type { User, UserFormData, ApiUser } from '../types/user';

const isMockMode = import.meta.env.VITE_MOCK_MODE === 'true';

const realUserService = {
    async getAll(): Promise<User[]> {
        const response = await api.get<ApiUser[]>('/users');
        return response.data.map(mapUserFromApi);
    },

    async getById(id: string): Promise<User> {
        const response = await api.get<ApiUser>(`/users/${id}`);
        return mapUserFromApi(response.data);
    },

    async search(query: string): Promise<User[]> {
        const response = await api.get<ApiUser[]>(`/users?search=${encodeURIComponent(query)}`);
        return response.data.map(mapUserFromApi);
    },

    async create(data: UserFormData): Promise<User> {
        const payload = mapUserToApi(data);
        const response = await api.post<ApiUser>('/users', payload);
        return mapUserFromApi(response.data);
    },

    async update(id: string, data: Partial<UserFormData>): Promise<User> {
        const payload = mapUserToApi(data);
        const response = await api.put<ApiUser>(`/users/${id}`, payload);
        return mapUserFromApi(response.data);
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/users/${id}`);
    },
};

export const userService = isMockMode ? mockUserService : realUserService;
