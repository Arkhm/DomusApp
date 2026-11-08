import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import type { CondoEvent, Notice } from './domain';

export type MainTabParamList = {
  Inicio: undefined;
  Reservas: undefined;
  Cobrancas: undefined;
  Perfil: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Ocorrencias: undefined;
  Comunicados: undefined;
  Comunicado: { notice: Notice };
  Eventos: undefined;
  Evento: { event: CondoEvent };
  Votacoes: undefined;
  FaturaDetalhe: { invoiceId: string };
  VeiculosPets: undefined;
  Notificacoes: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  /** Tela "Em breve" para módulos que ainda não têm implementação. */
  EmBreve: { title: string; description?: string };
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  BottomTabScreenProps<MainTabParamList, T>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
