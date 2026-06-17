import api from './api';
import type { Unit, UnitType } from '../types/user';

export interface UnitFormData {
    type: UnitType;
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

    async update(id: string, data: Partial<UnitFormData>): Promise<Unit> {
        const response = await api.put<Unit>(`/units/${id}`, data);
        return response.data;
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/units/${id}`);
    },
};
