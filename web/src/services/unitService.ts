import api from './api';
import type { Unit } from '../types/user';

export interface UnitFormData {
    block?: string;
    number: string;
}

export const unitService = {
    async getAll(): Promise<Unit[]> {
        const response = await api.get<Unit[]>('/units');
        return response.data;
    },

    async create(data: UnitFormData): Promise<Unit> {
        const response = await api.post<Unit>('/units', data);
        return response.data;
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/units/${id}`);
    },
};
