import api from './api';
import type { Unit } from '../types/user';

export const unitService = {
    async getAll(): Promise<Unit[]> {
        const response = await api.get<Unit[]>('/units');
        return response.data;
    },
};
