export type ReservationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface Reservation {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: ReservationStatus;
    rejectionReason: string | null;
    createdAt: string;
    commonArea: { id: string; name: string };
    user: {
        id: string;
        name: string;
        unit: { id: string; block: string | null; number: string } | null;
    };
}

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
    PENDING: 'Pendente',
    APPROVED: 'Aprovada',
    REJECTED: 'Rejeitada',
    CANCELLED: 'Cancelada',
};
