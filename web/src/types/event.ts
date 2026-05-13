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
}

export interface EventFormData {
    title: string;
    content: string;
    eventDate: string;
    location?: string;
    targetType: 'ALL' | 'UNIT';
    targetUnitId?: string;
}
