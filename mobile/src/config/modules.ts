import type { IoniconName } from '../components';

/**
 * Situação do módulo do lado da API (`./api`), verificada contra
 * `api/src/server.ts` e as rotas existentes. Serve para a tela "Em breve"
 * dizer a verdade sobre o que falta.
 */
export type ModuleApiStatus =
  /** Existe endpoint e o morador consegue consumir. */
  | 'ready'
  /** Existe endpoint, mas hoje é restrito a ADMIN/FUNCIONARIO. */
  | 'restricted'
  /** Não existe endpoint na API. */
  | 'missing';

export interface AppModule {
  id: string;
  label: string;
  icon: IoniconName;
  apiStatus: ModuleApiStatus;
  screen?: 'Reservas' | 'Ocorrencias';
  /** O que ainda falta — exibido na tela "Em breve". */
  pendingNote: string;
}

/** Grid de acesso rápido da Home; módulos com `screen` abrem uma tela real. */
export const APP_MODULES: readonly AppModule[] = [
  {
    id: 'comunicados',
    label: 'Comunicados',
    icon: 'megaphone-outline',
    apiStatus: 'ready',
    pendingNote: 'A API já expõe GET /notices. Falta a tela de listagem e leitura.',
  },
  {
    id: 'cobrancas',
    label: 'Cobranças',
    icon: 'receipt-outline',
    apiStatus: 'missing',
    pendingNote: 'A API ainda não tem /charges nem modelo de cobrança no schema.prisma.',
  },
  {
    id: 'reservas',
    label: 'Reservas',
    icon: 'calendar-outline',
    apiStatus: 'ready',
    screen: 'Reservas',
    pendingNote: 'Consulte suas reservas, solicite uma área ativa e cancele reservas futuras.',
  },
  {
    id: 'acessos',
    label: 'Acessos',
    icon: 'key-outline',
    apiStatus: 'missing',
    pendingNote: 'A API ainda não tem controle de acesso/portaria.',
  },
  {
    id: 'encomendas',
    label: 'Encomendas',
    icon: 'cube-outline',
    apiStatus: 'missing',
    pendingNote: 'A API ainda não tem /packages.',
  },
  {
    id: 'ocorrencias',
    label: 'Ocorrências',
    icon: 'alert-circle-outline',
    apiStatus: 'ready',
    screen: 'Ocorrencias',
    pendingNote: 'Registre ocorrências e acompanhe o status e a resposta da administração.',
  },
  {
    id: 'votacoes',
    label: 'Votações',
    icon: 'checkbox-outline',
    apiStatus: 'restricted',
    pendingNote:
      'GET /votings existe, mas hoje só ADMIN e FUNCIONARIO podem listar. Falta liberar para morador e criar o endpoint de voto.',
  },
  {
    id: 'documentos',
    label: 'Documentos',
    icon: 'document-text-outline',
    apiStatus: 'missing',
    pendingNote: 'A API ainda não tem armazenamento de documentos.',
  },
  {
    id: 'achados',
    label: 'Achados e Perdidos',
    icon: 'search-outline',
    apiStatus: 'missing',
    pendingNote: 'A API ainda não tem achados e perdidos.',
  },
  {
    id: 'multas',
    label: 'Multas',
    icon: 'warning-outline',
    apiStatus: 'missing',
    pendingNote: 'A API ainda não tem modelo de multa/infração.',
  },
  {
    id: 'visitantes',
    label: 'Visitantes',
    icon: 'people-outline',
    apiStatus: 'missing',
    pendingNote: 'A API ainda não tem /visitors.',
  },
  {
    id: 'notificacoes',
    label: 'Notificações',
    icon: 'notifications-outline',
    apiStatus: 'missing',
    pendingNote: 'A API ainda não tem /notifications nem push.',
  },
  {
    id: 'pagamentos',
    label: 'Pagamentos',
    icon: 'card-outline',
    apiStatus: 'missing',
    pendingNote: 'Depende de Cobranças e de uma integração de pagamento.',
  },
  {
    id: 'ajuda',
    label: 'Ajuda',
    icon: 'help-buoy-outline',
    apiStatus: 'missing',
    pendingNote: 'Conteúdo de ajuda e canal de suporte ainda não definidos.',
  },
  {
    id: 'historico',
    label: 'Histórico',
    icon: 'time-outline',
    apiStatus: 'missing',
    pendingNote: 'A API ainda não tem trilha de auditoria consultável pelo morador.',
  },
] as const;
