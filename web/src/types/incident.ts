export type IncidentCategory = 'BARULHO' | 'MANUTENCAO' | 'SEGURANCA' | 'LIMPEZA' | 'OUTRO';
export type IncidentStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface Incident {
    id: string;
    title: string;
    description: string;
    category: IncidentCategory;
    status: IncidentStatus;
    response: string | null;
    respondedAt: string | null;
    createdAt: string;
    updatedAt: string;
    author: { id: string; name: string };
    unit: { id: string; block: string | null; number: string } | null;
}

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
    OPEN: 'Aberta',
    IN_PROGRESS: 'Em andamento',
    RESOLVED: 'Resolvida',
    CLOSED: 'Encerrada',
};

export const INCIDENT_CATEGORY_LABELS: Record<IncidentCategory, string> = {
    BARULHO: 'Barulho',
    MANUTENCAO: 'Manutenção',
    SEGURANCA: 'Segurança',
    LIMPEZA: 'Limpeza',
    OUTRO: 'Outro',
};
