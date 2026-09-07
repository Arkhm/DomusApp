import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ConfirmSheet,
  ModuleCard,
  SectionHeader,
  StatusBanner,
  SummaryTile,
} from '../components';
import { useAuth } from '../contexts/AuthContext';
import { useHomeSummary } from '../hooks/useHomeSummary';
import { APP_MODULES, type AppModule } from '../config/modules';
import {
  firstName,
  formatEventDateTime,
  greetingFor,
  relativeDay,
  roleLabel,
  unitLabel,
} from '../utils/format';
import { colors, layout, radius, spacing, typography } from '../theme';
import type { RootStackParamList } from '../types';

type HomeNavigation = NativeStackNavigationProp<RootStackParamList>;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

/** Texto do bloco "Avisos" conforme o que a API informa para o perfil logado. */
function noticeTile(unread: number | null, total: number): { value: string; detail: string } {
  if (unread === null) {
    return {
      value: String(total),
      detail: total === 1 ? 'comunicado publicado' : 'comunicados publicados',
    };
  }
  return {
    value: String(unread),
    detail: unread === 1 ? 'aviso não lido' : 'avisos não lidos',
  };
}

export function HomeScreen(): React.JSX.Element {
  const navigation = useNavigation<HomeNavigation>();
  const { user, signOut } = useAuth();
  const { summary, isLoading, isRefreshing, failure, reload } = useHomeSummary();
  const [isSignOutVisible, setIsSignOutVisible] = React.useState(false);

  const residence = unitLabel(user) ?? roleLabel(user);
  const notices = noticeTile(summary.unreadNotices, summary.totalNotices);
  const nextEvent = summary.nextEvent;

  function confirmSignOut(): void {
    // Fecha antes de sair: com a sessão encerrada o Stack troca para o Login e
    // o modal não deve sobreviver à transição.
    setIsSignOutVisible(false);
    void signOut();
  }

  function openModule(module: AppModule): void {
    // Nenhum módulo tem tela própria nesta entrega: todos caem no placeholder,
    // que explica o que falta do lado da API.
    navigation.navigate('EmBreve', {
      title: module.label,
      description: module.pendingNote,
    });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={reload}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.greetingBlock}>
              <Text style={styles.greeting}>{greetingFor()},</Text>
              <Text style={styles.name} numberOfLines={1}>
                {user ? firstName(user.name) : 'morador(a)'}
              </Text>

              <View style={styles.residenceChip}>
                <Text style={styles.residenceText} numberOfLines={1}>
                  {residence}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => setIsSignOutVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={user ? `Conta de ${user.name}` : 'Conta'}
              accessibilityHint="Abre a confirmação para sair da conta"
              style={({ pressed }) => [styles.avatar, pressed ? styles.avatarPressed : null]}
            >
              <Text style={styles.avatarText}>{user ? initialsOf(user.name) : '--'}</Text>
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.summaryLoading}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.summaryLoadingText}>Carregando o resumo…</Text>
            </View>
          ) : (
            <View style={styles.summaryRow}>
              <SummaryTile
                icon="megaphone-outline"
                value={failure ? '—' : notices.value}
                label="Comunicados"
                detail={failure ? 'indisponível agora' : notices.detail}
              />

              <SummaryTile
                icon="calendar-outline"
                value={
                  failure ? '—' : nextEvent ? relativeDay(nextEvent.eventDate) : 'Sem data'
                }
                label="Próximo evento"
                detail={
                  failure
                    ? 'indisponível agora'
                    : nextEvent
                      ? `${nextEvent.title} · ${formatEventDateTime(nextEvent)}`
                      : 'Nada agendado por enquanto'
                }
              />
            </View>
          )}
        </View>

        <View style={styles.body}>
          {failure ? (
            <StatusBanner
              tone={failure.kind === 'network' ? 'warning' : 'error'}
              title={
                failure.kind === 'network'
                  ? 'Sem conexão com o servidor'
                  : 'Não foi possível carregar o resumo'
              }
              message={failure.message}
              actionLabel="Tentar de novo"
              onAction={reload}
            />
          ) : null}

          <SectionHeader
            overline="Acesso rápido"
            title="Módulos do condomínio"
            caption="Toque em um módulo para abrir."
          />

          <View style={styles.grid}>
            {APP_MODULES.map((module) => (
              <View key={module.id} style={styles.gridItem}>
                <ModuleCard
                  label={module.label}
                  icon={module.icon}
                  onPress={() => openModule(module)}
                  isComingSoon
                />
              </View>
            ))}
          </View>

          <Text style={styles.legend}>
            O ponto dourado marca os módulos que ainda não têm tela nesta versão.
          </Text>
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={isSignOutVisible}
        title="Sair da conta?"
        message={
          user
            ? `Você está conectado como ${user.name}. Será preciso entrar de novo para voltar.`
            : 'Será preciso entrar de novo para voltar.'
        }
        confirmLabel="Sair da conta"
        onConfirm={confirmSignOut}
        onCancel={() => setIsSignOutVisible(false)}
      />
    </SafeAreaView>
  );
}

const GRID_COLUMNS = 3;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.brand,
  },
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.huge,
  },
  header: {
    backgroundColor: colors.brand,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
    gap: spacing.xl,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  greetingBlock: {
    flex: 1,
    gap: spacing.xxs,
  },
  greeting: {
    ...typography.body,
    color: colors.textOnBrandMuted,
  },
  name: {
    ...typography.display,
    color: colors.textOnBrand,
  },
  residenceChip: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
  },
  residenceText: {
    ...typography.label,
    color: colors.accent,
  },
  avatar: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPressed: {
    opacity: 0.85,
  },
  avatarText: {
    ...typography.label,
    color: colors.textOnBrand,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryLoading: {
    minHeight: 96,
    borderRadius: radius.lg,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  summaryLoadingText: {
    ...typography.caption,
    color: colors.textOnBrandMuted,
  },
  body: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xxl,
    gap: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridItem: {
    // `flexBasis` abaixo de 100/3% garante 3 colunas mesmo com o `gap`;
    // `flexGrow` iguala as larguras na linha.
    flexBasis: `${100 / GRID_COLUMNS - 6}%`,
    flexGrow: 1,
  },
  legend: {
    ...typography.caption,
    color: colors.textMuted,
    paddingTop: spacing.xs,
  },
});
