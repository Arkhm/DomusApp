import api from './api';
import type { Event, EventFormData } from '../types/event';

export const eventService = {
    async getAll(): Promise<Event[]> {
        const response = await api.get<Event[]>('/events');
        return response.data;
    },

    async create(data: EventFormData): Promise<Event> {
        const response = await api.post<Event>('/events', data);
        return response.data;
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/events/${id}`);
    },
};
