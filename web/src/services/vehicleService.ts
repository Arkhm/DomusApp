import api from './api';
import type { PanelVehicle, Vehicle, VehicleFilters, VehicleInput } from '../types/vehicle';

export const vehicleService = {
    getAll: async (params: VehicleFilters = {}) => (await api.get<PanelVehicle[]>('/vehicles', { params })).data,
    create: async (data: VehicleInput & { unitId: string }) => (await api.post<Vehicle>('/vehicles', data)).data,
    update: async (id: string, data: VehicleInput) => (await api.put<Vehicle>(`/vehicles/${id}`, data)).data,
    delete: async (id: string) => { await api.delete(`/vehicles/${id}`); },
};
