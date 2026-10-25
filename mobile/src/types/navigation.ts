import type { NavigatorScreenParams } from '@react-navigation/native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CondoEvent, Notice, Voting } from './domain';

export type MainTabParamList = {
  Inicio: undefined;
  Reservas: undefined;
  Acessos: undefined;
  Notificacoes: undefined;
  Perfil: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Comunicados: undefined;
  Comunicado: { notice: Notice };
  Eventos: undefined;
  Evento: { event: CondoEvent };
  Votacoes: undefined;
  Votacao: { voting: Voting };
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  /** Tela "Em breve" para módulos que ainda não têm implementação. */
  EmBreve: { title: string; description?: string };
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  StackScreenProps<RootStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  BottomTabScreenProps<MainTabParamList, T>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
