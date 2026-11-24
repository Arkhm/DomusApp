import api from './api';
import type { Incident, IncidentCategory, IncidentStatus } from '../types/incident';

export const incidentService = {
    async getAll(params: { status?: IncidentStatus; category?: IncidentCategory } = {}): Promise<Incident[]> {
        const response = await api.get<Incident[]>('/incidents', { params });
        return response.data;
    },
    async getById(id: string): Promise<Incident> {
        const response = await api.get<Incident>(`/incidents/${id}`);
        return response.data;
    },
    async update(id: string, data: { status?: IncidentStatus; response?: string }): Promise<Incident> {
        const response = await api.put<Incident>(`/incidents/${id}`, data);
        return response.data;
    },
};
