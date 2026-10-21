import { api } from './api';
import type { Voting } from '../types';

/**
 * `GET /votings` → `Voting[]`.
 *
 * Cada votação vem com `status` (calculado no servidor), `hasVoted` e
 * `myOptionId`. A contagem `votes` das opções só aparece depois que a votação
 * encerra (o painel recebe sempre).
 */
export async function listVotings(): Promise<Voting[]> {
  const { data } = await api.get<Voting[]>('/votings');
  return data;
}

/**
 * `POST /votings/:id/vote` → `{ message, myOptionId }`.
 *
 * Voto único por morador e sem troca. Falhas esperadas: 409 (já votou, votação
 * encerrada ou ainda não aberta) e 403 (quem não é morador ativo).
 */
export async function castVote(votingId: string, optionId: string): Promise<void> {
  await api.post(`/votings/${votingId}/vote`, { optionId });
}
