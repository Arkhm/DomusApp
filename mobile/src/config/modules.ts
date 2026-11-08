import type { IoniconName } from '../components';
import type { MainTabParamList, RootStackParamList } from '../types';

/** Rotas que um módulo pode abrir: telas do Stack ou abas do app. */
export type ModuleTarget =
  | { stack: Exclude<keyof RootStackParamList, 'Login' | 'Main' | 'EmBreve' | 'Comunicado' | 'Evento' | 'FaturaDetalhe'> }
  | { tab: keyof MainTabParamList };

export interface AppModule {
  id: string;
  label: string;
  icon: IoniconName;
  target: ModuleTarget;
}

/**
 * Grid de acesso rápido da Home. Só entram módulos com tela e endpoint de
 * morador na API; o que não existe na API (portaria, encomendas, visitantes…)
 * fica fora do app em vez de aparecer como "em breve".
 */
export const APP_MODULES: readonly AppModule[] = [
  { id: 'comunicados', label: 'Comunicados', icon: 'megaphone-outline', target: { stack: 'Comunicados' } },
  { id: 'eventos', label: 'Eventos', icon: 'calendar-number-outline', target: { stack: 'Eventos' } },
  { id: 'votacoes', label: 'Votações', icon: 'checkbox-outline', target: { stack: 'Votacoes' } },
  { id: 'cobrancas', label: 'Cobranças', icon: 'receipt-outline', target: { tab: 'Cobrancas' } },
  { id: 'reservas', label: 'Reservas', icon: 'calendar-outline', target: { tab: 'Reservas' } },
  { id: 'ocorrencias', label: 'Ocorrências', icon: 'alert-circle-outline', target: { stack: 'Ocorrencias' } },
  { id: 'notificacoes', label: 'Notificações', icon: 'notifications-outline', target: { stack: 'Notificacoes' } },
  { id: 'veiculos-pets', label: 'Veículos e pets', icon: 'car-outline', target: { stack: 'VeiculosPets' } },
] as const;
