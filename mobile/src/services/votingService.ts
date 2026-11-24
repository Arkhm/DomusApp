import { api } from './api';
import { getVotingStatus, type Voting } from '../types/voting';

/** GET /votings devolve um array com myVote da unidade, sem status calculado. */
export async function listVotings(): Promise<Voting[]> {
  const { data } = await api.get<Omit<Voting, 'status'>[]>('/votings');
  return data.map((voting) => ({ ...voting, status: getVotingStatus(voting) }));
}

/** POST /votings/:id/votes -> { message }; um voto por unidade, sem troca. */
export async function castVote(votingId: string, optionId: string): Promise<void> {
  await api.post<{ message: string }>(`/votings/${votingId}/votes`, { optionId });
}
