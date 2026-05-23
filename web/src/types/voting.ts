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

export type VotingStatus = 'ACTIVE' | 'CLOSED';

export function getVotingStatus(v: Voting, now: Date = new Date()): VotingStatus {
    const start = new Date(v.startDate).getTime();
    const end = new Date(v.endDate).getTime();
    const n = now.getTime();
    return n >= start && n <= end ? 'ACTIVE' : 'CLOSED';
}

export function totalVotes(v: Voting): number {
    return v.options.reduce((acc, o) => acc + (o.votes || 0), 0);
}
