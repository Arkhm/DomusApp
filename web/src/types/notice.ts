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
}

export interface NoticeFormData {
    title: string;
    content: string;
    targetType: 'ALL' | 'UNIT';
    targetUnitId?: string;
}

export const TARGET_TYPE_LABELS: Record<string, string> = {
    ALL: 'Todos',
    UNIT: 'Unidade Específica',
};
