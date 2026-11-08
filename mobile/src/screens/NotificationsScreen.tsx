import React from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, SectionHeader, StatusBanner } from '../components';
import { useNotifications } from '../hooks/useNotifications';
import type { AppNotification } from '../types/notification';
import type { RootStackParamList } from '../types/navigation';
import { colors, layout, radius, spacing, typography } from '../theme';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

export function NotificationsScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { items, isLoading, isRefreshing, failure, openingId, unreadCount, reload, loadTarget } = useNotifications();

  async function open(item: AppNotification): Promise<void> {
    const target = await loadTarget(item);
    if (!target) return;
    if (target.type === 'NOTICE') navigation.navigate('Comunicado', { notice: target.notice });
    else navigation.navigate('Evento', { event: target.event });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={reload} tintColor={colors.brand} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <SectionHeader title="Notificações" caption="Acompanhe os comunicados e eventos do seu condomínio." />
            {failure ? <StatusBanner tone="error" title="Não foi possível atualizar" message={failure.message}
              actionLabel="Tentar de novo" onAction={reload} /> : null}
            <Text style={styles.text} accessibilityLiveRegion="polite">
              {isLoading ? 'Carregando notificações…' : `${unreadCount} ${unreadCount === 1 ? 'não lida' : 'não lidas'}`}
            </Text>
            <Button label="Atualizar notificações" variant="ghost" onPress={reload} disabled={isLoading || isRefreshing || openingId !== null} />
            {isLoading ? <ActivityIndicator color={colors.brand} accessibilityLabel="Carregando notificações" /> : null}
          </View>
        }
        ListEmptyComponent={!isLoading && !failure ? <Text style={styles.text}>Nenhuma notificação por enquanto. Novos comunicados e eventos aparecerão aqui.</Text> : null}
        renderItem={({ item }) => {
          const date = new Date(item.createdAt);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.description}: ${item.title}. ${item.isRead ? 'Lida' : 'Não lida'}. Abrir`}
              accessibilityState={{ disabled: openingId !== null, busy: openingId === item.id }}
              disabled={openingId !== null}
              onPress={() => void open(item)}
              style={({ pressed }) => [styles.card, !item.isRead ? styles.unread : null, pressed ? styles.pressed : null]}
            >
              <Text style={styles.kind}>{item.description} · {item.isRead ? 'Lida' : 'Não lida'}</Text>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.text}>{Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date)}</Text>
              {openingId === item.id ? <ActivityIndicator color={colors.brand} accessibilityLabel="Abrindo notificação" /> : null}
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, gap: spacing.xl, flexGrow: 1 },
  header: { gap: spacing.lg },
  card: { minHeight: layout.minTouchTarget, backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  unread: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  pressed: { backgroundColor: colors.surfaceMuted },
  title: { ...typography.subtitle, color: colors.textPrimary },
  kind: { ...typography.bodyStrong, color: colors.brand },
  text: { ...typography.body, color: colors.textSecondary },
});
