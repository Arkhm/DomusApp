import type { AuthorSummary } from './domain';

export type VotingStatus = 'OPEN' | 'SCHEDULED' | 'CLOSED';
export interface VotingOption {
  id: string;
  text: string;
  /** Omitido para moradores comuns antes do encerramento. */
  votes?: number;
}
export interface UnitVote {
  optionId: string;
  votedAt: string;
  votedBy: string | null;
}
export interface Voting {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  author: AuthorSummary;
  options: VotingOption[];
  myVote: UnitVote | null;
  /** Derivado no cliente; não vem de GET /votings. */
  status: VotingStatus;
}

export function getVotingStatus(voting: Pick<Voting, 'startDate' | 'endDate'>, now = Date.now()): VotingStatus {
  if (now < Date.parse(voting.startDate)) return 'SCHEDULED';
  if (now > Date.parse(voting.endDate)) return 'CLOSED';
  return 'OPEN';
}
