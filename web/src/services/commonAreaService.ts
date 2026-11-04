import api from './api';
import type { CommonArea, CommonAreaFormData } from '../types/commonArea';

export const commonAreaService = {
    async getAll(): Promise<CommonArea[]> {
        const response = await api.get<CommonArea[]>('/common-areas');
        return response.data;
    },
    async create(data: CommonAreaFormData): Promise<CommonArea> {
        const response = await api.post<CommonArea>('/common-areas', data);
        return response.data;
    },
    async update(id: string, data: Partial<CommonAreaFormData>): Promise<CommonArea> {
        const response = await api.put<CommonArea>(`/common-areas/${id}`, data);
        return response.data;
    },
    async delete(id: string): Promise<void> {
        await api.delete(`/common-areas/${id}`);
    },
};
