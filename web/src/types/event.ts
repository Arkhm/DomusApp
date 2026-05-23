export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED';
export type EventCategory =
    | 'ASSEMBLEIA'
    | 'CONFRATERNIZACAO'
    | 'MANUTENCAO'
    | 'REUNIAO'
    | 'OUTRO';

export interface Event {
    id: string;
    title: string;
    content: string;
    eventDate: string;
    location: string | null;
    targetType: 'ALL' | 'UNIT';
    targetUnitId: string | null;
    targetUnit: { id: string; block: string | null; number: string } | null;
    authorId: string;
    author: { name: string; role: string };
    createdAt: string;
    updatedAt: string;

    status: EventStatus;
    category: EventCategory;
    capacity: number | null;
}

export interface EventFormData {
    title: string;
    content: string;
    eventDate: string;
    location?: string;
    targetType: 'ALL' | 'UNIT';
    targetUnitId?: string;
    status?: EventStatus;
    category?: EventCategory;
    capacity?: number | null;
}

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
    DRAFT: 'Rascunho',
    PUBLISHED: 'Publicado',
    CANCELLED: 'Cancelado',
};

export const EVENT_CATEGORY_LABEL: Record<EventCategory, string> = {
    ASSEMBLEIA: 'Assembleia',
    CONFRATERNIZACAO: 'Confraternização',
    MANUTENCAO: 'Manutenção',
    REUNIAO: 'Reunião',
    OUTRO: 'Outro',
};
