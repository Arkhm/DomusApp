import { votingRepository } from '../repositories/votingRepository';
import { userRepository } from '../repositories/userRepository';
import { hasPanelAccess } from '../lib/access';

export type VotingStatus = 'SCHEDULED' | 'OPEN' | 'CLOSED';

// Erro com status HTTP próprio: o resto da API responde 400 para tudo, mas
// "já votou" (409) e "só morador vota" (403) precisam ser distinguíveis no app.
export class VotingError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// O status é derivado das datas, no relógio do servidor — o relógio do celular
// não decide se uma votação está aberta.
const statusOf = (voting: { startDate: Date; endDate: Date }, now: Date): VotingStatus => {
  if (now < voting.startDate) return 'SCHEDULED';
  if (now >= voting.endDate) return 'CLOSED';
  return 'OPEN';
};

export const votingService = {
  async create(data: {
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    options: string[];
    authorId: string;
  }) {
    if (!data.title || !data.title.trim()) {
      throw new Error('Título é obrigatório.');
    }
    if (!data.description || !data.description.trim()) {
      throw new Error('Descrição é obrigatória.');
    }
    if (!data.startDate || !data.endDate) {
      throw new Error('Data de início e data de término são obrigatórias.');
    }

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (isNaN(startDate.getTime())) {
      throw new Error('Data de início inválida.');
    }
    if (isNaN(endDate.getTime())) {
      throw new Error('Data de término inválida.');
    }
    if (startDate >= endDate) {
      throw new Error('A data de início deve ser anterior à data de término.');
    }

    if (!Array.isArray(data.options) || data.options.length < 2) {
      throw new Error('A votação deve conter pelo menos duas opções.');
    }

    const cleanedOptions = data.options.map((opt) => (typeof opt === 'string' ? opt.trim() : ''));

    if (cleanedOptions.some((opt) => opt.length === 0)) {
      throw new Error('Todas as opções devem conter texto.');
    }

    return await votingRepository.create({
      title: data.title.trim(),
      description: data.description.trim(),
      startDate,
      endDate,
      authorId: data.authorId,
      options: cleanedOptions
    });
  },

  // Toda votação sai com `status`, `hasVoted` e `myOptionId` (do próprio usuário).
  // A contagem de votos por opção só vai para quem tem acesso ao painel ou depois
  // que a votação encerra: antes disso o morador não recebe `votes`, então o
  // resultado parcial não vaza nem lendo o JSON da resposta.
  async list(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new VotingError('Usuário não encontrado.', 404);
    }

    const [votings, myVotes] = await Promise.all([
      votingRepository.findAll(),
      votingRepository.findVotesByUser(userId)
    ]);

    const chosen = new Map(myVotes.map((vote) => [vote.votingId, vote.optionId]));
    const panel = hasPanelAccess(user);
    const now = new Date();

    return votings.map((voting) => {
      const status = statusOf(voting, now);
      const myOptionId = chosen.get(voting.id) ?? null;
      const showCounts = panel || status === 'CLOSED';

      return {
        ...voting,
        status,
        hasVoted: myOptionId !== null,
        myOptionId,
        options: voting.options.map(({ votes, ...option }) =>
          showCounts ? { ...option, votes } : option
        )
      };
    });
  },

  async vote(votingId: string, optionId: string, userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new VotingError('Usuário não encontrado.', 404);
    }
    if (user.role !== 'MORADOR' || user.status !== 'ACTIVE') {
      throw new VotingError('Somente moradores ativos podem votar.', 403);
    }

    const voting = await votingRepository.findById(votingId);
    if (!voting) {
      throw new VotingError('Votação não encontrada.', 404);
    }

    const status = statusOf(voting, new Date());
    if (status === 'SCHEDULED') {
      throw new VotingError('Esta votação ainda não começou.', 409);
    }
    if (status === 'CLOSED') {
      throw new VotingError('Esta votação já foi encerrada.', 409);
    }

    if (!voting.options.some((option) => option.id === optionId)) {
      throw new VotingError('Opção inválida para esta votação.', 400);
    }

    try {
      await votingRepository.castVote({ votingId, optionId, userId });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new VotingError('Você já votou nesta votação.', 409);
      }
      throw error;
    }

    return { message: 'Voto registrado com sucesso.', myOptionId: optionId };
  },

  async delete(id: string) {
    const voting = await votingRepository.findById(id);

    if (!voting) {
      throw new Error('Votação não encontrada.');
    }

    await votingRepository.delete(id);
    return { message: 'Votação removida com sucesso.' };
  }
};
