import type { Unit } from './user';

export type ParkingType = 'RESIDENT' | 'VISITOR' | 'DISABLED';
export const PARKING_TYPE_LABELS: Record<ParkingType, string> = {
    RESIDENT: 'Morador', VISITOR: 'Visitante', DISABLED: 'PcD',
};
export interface ParkingSpot {
    id: string;
    number: string;
    type: ParkingType;
    unitId: string | null;
    unit: Pick<Unit, 'id' | 'type' | 'block' | 'number'> | null;
}
export interface ParkingSpotInput { number: string; type: ParkingType }
export interface ParkingSpotFilters { type?: ParkingType; block?: string; unitId?: string; free?: 'true' | 'false' }
