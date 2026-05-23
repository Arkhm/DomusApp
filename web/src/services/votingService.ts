import api from './api';
import type { Voting, VotingFormData } from '../types/voting';

export const votingService = {
    async getAll(): Promise<Voting[]> {
        const response = await api.get<Voting[]>('/votings');
        return response.data;
    },

    async create(data: VotingFormData): Promise<Voting> {
        const response = await api.post<Voting>('/votings', data);
        return response.data;
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/votings/${id}`);
    },
};
