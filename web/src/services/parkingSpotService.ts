import api from './api';
import type { ParkingSpot, ParkingSpotInput, ParkingSpotFilters } from '../types/parkingSpot';

export const parkingSpotService = {
    getAll: async (params: ParkingSpotFilters = {}) => (await api.get<ParkingSpot[]>('/parking-spots', { params })).data,
    create: async (data: ParkingSpotInput) => (await api.post<ParkingSpot>('/parking-spots', data)).data,
    update: async (id: string, data: Partial<ParkingSpotInput>) => (await api.put<ParkingSpot>(`/parking-spots/${id}`, data)).data,
    assign: async (id: string, unitId: string | null) => (await api.put<ParkingSpot>(`/parking-spots/${id}/assign`, { unitId })).data,
    delete: async (id: string) => { await api.delete(`/parking-spots/${id}`); },
};
