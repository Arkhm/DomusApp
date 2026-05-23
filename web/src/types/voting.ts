export interface VotingOption {
    id: string;
    text: string;
    votes: number;
}

export interface Voting {
    id: string;
    title: string;
    description: string;
    startDate: string; // ISO
    endDate: string;   // ISO
    author: { name: string; role: string };
    options: VotingOption[];
    createdAt: string;
    updatedAt: string;
}

export interface VotingFormData {
    title: string;
    description: string;
    startDate: string; // ISO
    endDate: string;   // ISO
    options: string[]; // min 2
}

export type VotingStatus = 'SCHEDULED' | 'ACTIVE' | 'CLOSED';

export const VOTING_STATUS_LABELS: Record<VotingStatus, string> = {
    SCHEDULED: 'Agendada',
    ACTIVE: 'Ativa',
    CLOSED: 'Encerrada',
};

/**
 * Status derivado por janela de tempo:
 * - SCHEDULED: ainda não começou (now < startDate)
 * - ACTIVE: dentro da janela [startDate, endDate]
 * - CLOSED: já encerrada (now > endDate)
 *
 * Antes só havia ACTIVE/CLOSED — votações futuras eram rotuladas como
 * "Encerrada" por padrão, o que enganava o admin.
 */
export function getVotingStatus(v: Voting, now: Date = new Date()): VotingStatus {
    const start = new Date(v.startDate).getTime();
    const end = new Date(v.endDate).getTime();
    const n = now.getTime();
    if (n < start) return 'SCHEDULED';
    if (n > end) return 'CLOSED';
    return 'ACTIVE';
}

export function totalVotes(v: Voting): number {
    return v.options.reduce((acc, o) => acc + (o.votes || 0), 0);
}
