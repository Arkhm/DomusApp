export type NoticeStatus = 'DRAFT' | 'PUBLISHED';
export type NoticePriority = 'NORMAL' | 'URGENT';

export interface Notice {
    id: string;
    title: string;
    content: string;
    targetType: 'ALL' | 'UNIT';
    targetUnitId: string | null;
    targetUnit: { id: string; block: string | null; number: string } | null;
    authorId: string;
    author: { name: string; role: string };
    createdAt: string;
    updatedAt: string;

    status: NoticeStatus;
    priority: NoticePriority;

    // Apenas no payload do admin
    readCount?: number;
    totalAddressees?: number;

    // Apenas no payload do morador
    isRead?: boolean;
}

export interface NoticeFormData {
    title: string;
    content: string;
    targetType: 'ALL' | 'UNIT';
    targetUnitId?: string;
    status?: NoticeStatus;
    priority?: NoticePriority;
}

export const TARGET_TYPE_LABELS: Record<string, string> = {
    ALL: 'Todos',
    UNIT: 'Unidade Específica',
};

export const NOTICE_STATUS_LABEL: Record<NoticeStatus, string> = {
    DRAFT: 'Rascunho',
    PUBLISHED: 'Publicado',
};

export const NOTICE_PRIORITY_LABEL: Record<NoticePriority, string> = {
    NORMAL: 'Normal',
    URGENT: 'Urgente',
};
