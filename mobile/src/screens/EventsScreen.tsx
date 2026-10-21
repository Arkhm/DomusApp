import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBanner } from '../components';
import { useEvents } from '../hooks/useEvents';
import { colors, elevation, layout, radius, spacing, typography } from '../theme';
import { formatEventDateTime, relativeDay } from '../utils/format';
import type { CondoEvent, EventCategory, RootStackScreenProps } from '../types';

type Filter = 'upcoming' | 'all';
const filters: { id: Filter; label: string }[] = [
  { id: 'upcoming', label: 'Próximos' }, { id: 'all', label: 'Todos' },
];
const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const CATEGORY_META: Record<EventCategory, { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  ASSEMBLEIA: { label: 'Assembleia', icon: 'people-outline' },
  CONFRATERNIZACAO: { label: 'Confraternização', icon: 'happy-outline' },
  MANUTENCAO: { label: 'Manutenção', icon: 'construct-outline' },
  REUNIAO: { label: 'Reunião', icon: 'chatbubbles-outline' },
  OUTRO: { label: 'Outro', icon: 'ellipsis-horizontal-outline' },
};

function isUpcoming(event: CondoEvent, now: Date): boolean {
  if (event.status === 'CANCELLED') return false;
  const date = new Date(event.eventDate);
  return !Number.isNaN(date.getTime()) && date.getTime() >= now.getTime();
}

function EventBadge({ event }: { event: CondoEvent }) {
  const meta = CATEGORY_META[event.category];
  const cancelled = event.status === 'CANCELLED';
  return <View style={[styles.badge, cancelled && styles.cancelledBadge]}>
    <Ionicons name={cancelled ? 'close-circle-outline' : meta.icon} size={spacing.lg} color={cancelled ? colors.danger : colors.textSecondary} />
    <Text style={[styles.badgeText, cancelled && styles.cancelledText]}>{cancelled ? 'Cancelado' : meta.label}</Text>
  </View>;
}

function BackButton({ onPress, label }: { onPress: () => void; label: string }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.back}>
    <Ionicons name="arrow-back" size={spacing.xxl} color={colors.textOnBrand} />
  </Pressable>;
}

export function EventsScreen({ navigation }: RootStackScreenProps<'Eventos'>) {
  const { events, loading, refreshing, failure, reload } = useEvents();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('upcoming');
  const now = useMemo(() => new Date(), [events]);
  const upcomingCount = useMemo(() => events.filter((event) => isUpcoming(event, now)).length, [events, now]);
  const visible = useMemo(() => events.filter((event) =>
    (filter !== 'upcoming' || isUpcoming(event, now)) &&
    normalize(`${event.title} ${event.location ?? ''} ${CATEGORY_META[event.category].label}`).includes(normalize(query.trim()))
  ), [events, query, filter, now]);

  return <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
    <View style={styles.hero}>
      <View style={styles.topRow}>
        <BackButton onPress={() => navigation.goBack()} label="Voltar para início" />
        <Text style={styles.overline}>VIDA EM CONDOMÍNIO</Text>
        <View style={styles.heroIcon}><Ionicons name="calendar-outline" size={spacing.xl} color={colors.accent} /></View>
      </View>
      <Text accessibilityRole="header" style={styles.heroTitle}>Eventos</Text>
      <Text style={styles.heroCaption}>A agenda do seu condomínio, sempre à mão.</Text>
      <View style={styles.heroFooter}>
        <Text style={styles.heroMeta}>{loading ? 'Carregando…' : `${events.length} no total`}</Text>
        {!loading && upcomingCount > 0 && <View style={styles.upcomingPill}><View style={styles.dot} /><Text style={styles.upcomingText}>{upcomingCount} {upcomingCount === 1 ? 'próximo' : 'próximos'}</Text></View>}
      </View>
    </View>
    <FlatList
      data={visible}
      keyExtractor={(event) => event.id}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={colors.brand} />}
      ListHeaderComponent={<View style={styles.controls}>
        <View style={styles.search}>
          <Ionicons name="search-outline" size={spacing.xl} color={colors.textSecondary} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Buscar eventos" accessibilityLabel="Buscar eventos" placeholderTextColor={colors.textSecondary} style={styles.searchInput} returnKeyType="search" />
          {query ? <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Limpar busca" style={styles.clear}><Ionicons name="close-circle" size={spacing.xl} color={colors.textSecondary} /></Pressable> : null}
        </View>
        <View style={styles.filters}>{filters.map((item) => <Pressable key={item.id} onPress={() => setFilter(item.id)} accessibilityRole="button" accessibilityState={{ selected: filter === item.id }} style={[styles.filter, filter === item.id && styles.filterActive]}><Text style={[styles.filterText, filter === item.id && styles.filterActiveText]}>{item.label}</Text></Pressable>)}</View>
        {failure && <StatusBanner tone="error" title="Não foi possível atualizar" message={failure.message} actionLabel="Tentar novamente" onAction={reload} />}
        <View style={styles.sectionRow}><Text style={styles.sectionLabel}>AGENDA DO CONDOMÍNIO</Text><Pressable onPress={reload} accessibilityRole="button" accessibilityLabel="Atualizar eventos" style={styles.clear}><Ionicons name="refresh-outline" size={spacing.xl} color={colors.textSecondary} /></Pressable></View>
      </View>}
      ListEmptyComponent={loading ? <ActivityIndicator color={colors.brand} accessibilityLabel="Carregando eventos" /> : !failure ? <View style={styles.empty}><Ionicons name="calendar-clear-outline" size={spacing.huge} color={colors.accent} /><Text style={styles.cardTitle}>{query || filter !== 'upcoming' ? 'Nenhum evento encontrado' : 'Nada agendado por enquanto'}</Text><Text style={styles.emptyText}>{query || filter !== 'upcoming' ? 'Experimente outra busca ou selecione Todos.' : 'Os próximos eventos do condomínio aparecerão aqui.'}</Text></View> : null}
      renderItem={({ item }) => <Pressable onPress={() => navigation.navigate('Evento', { event: item })} accessibilityRole="button" accessibilityLabel={`${item.title}. ${item.status === 'CANCELLED' ? 'Cancelado. ' : ''}${formatEventDateTime(item)}. Abrir evento`} style={({ pressed }) => [styles.card, elevation.card, pressed && styles.pressed]}>
        <View style={styles.cardTop}><EventBadge event={item} /><Text style={styles.date}>{relativeDay(item.eventDate)}</Text></View>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.meta}>{formatEventDateTime(item)}</Text>
        {item.location && <View style={styles.locationRow}><Ionicons name="location-outline" size={spacing.lg} color={colors.textSecondary} /><Text style={styles.locationText} numberOfLines={1}>{item.location}</Text></View>}
        <View style={styles.cardFooter}><View style={styles.author}><Ionicons name="business-outline" size={spacing.lg} color={colors.textSecondary} /><Text style={styles.authorText} numberOfLines={1}>{item.author?.name ?? 'Administração'}</Text></View><View style={styles.readLink}><Text style={styles.linkText}>Ver detalhes</Text><Ionicons name="arrow-forward" size={spacing.lg} color={colors.brand} /></View></View>
      </Pressable>}
    />
  </SafeAreaView>;
}

export function EventDetailScreen({ route, navigation }: RootStackScreenProps<'Evento'>) {
  const { event } = route.params;
  const cancelled = event.status === 'CANCELLED';
  const meta = CATEGORY_META[event.category];
  return <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
    <View style={styles.detailHeader}><BackButton onPress={() => navigation.goBack()} label="Voltar para eventos" /><Text style={styles.headerLabel}>Eventos</Text></View>
    <ScrollView style={styles.list} contentContainerStyle={styles.articleWrap}>
      <View style={styles.article}>
        <EventBadge event={event} />
        <Text accessibilityRole="header" style={styles.articleTitle}>{event.title}</Text>
        <Text style={styles.date}>{formatEventDateTime(event)}</Text>
        {event.location && <View style={styles.locationRow}><Ionicons name="location-outline" size={spacing.lg} color={colors.textSecondary} /><Text style={styles.locationText}>{event.location}</Text></View>}
        {event.capacity !== null && <View style={styles.locationRow}><Ionicons name="people-outline" size={spacing.lg} color={colors.textSecondary} /><Text style={styles.locationText}>Capacidade: {event.capacity} {event.capacity === 1 ? 'pessoa' : 'pessoas'}</Text></View>}
        <View style={styles.sender}><View style={styles.senderIcon}><Ionicons name={meta.icon} size={spacing.xl} color={colors.brand} /></View><View style={styles.senderCopy}><Text style={styles.senderName}>{event.author?.name ?? 'Administração'}</Text><Text style={styles.date}>{event.targetType === 'UNIT' ? 'Para sua unidade' : 'Para todo o condomínio'}</Text></View></View>
        <Text selectable style={styles.articleBody}>{event.content}</Text>
      </View>
      {cancelled && <StatusBanner tone="error" title="Evento cancelado" message="Este evento não vai mais acontecer." />}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.brand },
  hero: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing.xxl, gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  back: { minWidth: layout.minTouchTarget, minHeight: layout.minTouchTarget, justifyContent: 'center' },
  overline: { ...typography.overline, color: colors.textOnBrandMuted },
  heroIcon: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.brandSoft },
  heroTitle: { ...typography.display, color: colors.textOnBrand },
  heroCaption: { ...typography.body, color: colors.textOnBrandMuted },
  heroFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  heroMeta: { ...typography.label, color: colors.textOnBrandMuted },
  upcomingPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.brandSoft, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill },
  upcomingText: { ...typography.label, color: colors.accent },
  dot: { width: spacing.sm, height: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.accent },
  list: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: layout.screenPadding, paddingBottom: spacing.huge, gap: spacing.md },
  controls: { gap: spacing.lg },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  searchInput: { flex: 1, minWidth: 0, minHeight: layout.minTouchTarget + spacing.sm, ...typography.body, color: colors.textPrimary },
  clear: { width: layout.minTouchTarget, height: layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', gap: spacing.sm },
  filter: { flex: 1, minHeight: layout.minTouchTarget, justifyContent: 'center', alignItems: 'center', borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  filterText: { ...typography.label, color: colors.textSecondary },
  filterActiveText: { color: colors.textOnBrand },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { ...typography.overline, color: colors.textSecondary },
  card: { padding: spacing.lg, gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  pressed: { opacity: 0.8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  cancelledBadge: { backgroundColor: colors.dangerSoft },
  badgeText: { ...typography.labelSmall, color: colors.textSecondary },
  cancelledText: { color: colors.danger },
  date: { ...typography.caption, color: colors.textSecondary },
  cardTitle: { ...typography.subtitle, color: colors.textPrimary },
  meta: { ...typography.body, color: colors.textSecondary },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  locationText: { ...typography.caption, flex: 1, color: colors.textSecondary },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  author: { flex: 1, flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  authorText: { flex: 1, ...typography.caption, color: colors.textSecondary },
  readLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  linkText: { ...typography.labelSmall, color: colors.brand },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.huge },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: layout.screenPadding, paddingVertical: spacing.sm },
  headerLabel: { ...typography.subtitle, color: colors.textOnBrand },
  articleWrap: { padding: layout.screenPadding, paddingBottom: spacing.huge, gap: spacing.xxl },
  article: { padding: spacing.xl, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, gap: spacing.lg },
  articleTitle: { ...typography.title, color: colors.textPrimary },
  sender: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  senderIcon: { padding: spacing.md, backgroundColor: colors.accentSoft, borderRadius: radius.pill },
  senderCopy: { flex: 1, gap: spacing.xs },
  senderName: { ...typography.label, color: colors.textPrimary },
  articleBody: { ...typography.body, lineHeight: typography.subtitle.lineHeight + spacing.xs, color: colors.textPrimary },
});
