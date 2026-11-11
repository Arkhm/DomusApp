import type { Unit } from './user';

export interface Vehicle {
    id: string;
    plate: string;
    model: string;
    color: string | null;
    unitId: string;
    createdAt: string;
    updatedAt: string;
}
export interface PanelVehicle extends Vehicle {
    unit: Unit & { parkingSpots: number; _count: { vehicles: number } };
}
export interface VehicleInput { plate: string; model: string; color?: string }
export interface VehicleFilters { plate?: string; block?: string; unitId?: string }
