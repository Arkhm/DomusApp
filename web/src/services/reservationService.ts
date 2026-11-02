import api from './api';
import type { Reservation, ReservationStatus } from '../types/reservation';

export interface ReservationFilters {
    status?: ReservationStatus;
    commonAreaId?: string;
    from?: string;
    to?: string;
}

export const reservationService = {
    async getAll(params: ReservationFilters = {}): Promise<Reservation[]> {
        const response = await api.get<Reservation[]>('/reservations', { params });
        return response.data;
    },
    async approve(id: string): Promise<Reservation> {
        const response = await api.put<Reservation>(`/reservations/${id}/approve`);
        return response.data;
    },
    async reject(id: string, reason?: string): Promise<Reservation> {
        const response = await api.put<Reservation>(`/reservations/${id}/reject`, { reason });
        return response.data;
    },
};
