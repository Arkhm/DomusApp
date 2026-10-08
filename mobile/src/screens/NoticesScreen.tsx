import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, StatusBanner } from '../components';
import { useNotices } from '../hooks/useNotices';
import { markNoticeAsRead } from '../services/noticeService';
import { toApiFailure } from '../services/api';
import { colors, elevation, layout, radius, spacing, typography } from '../theme';
import type { Notice, RootStackScreenProps } from '../types';

type Filter = 'all' | 'unread' | 'urgent';
const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' }, { id: 'unread', label: 'Não lidos' }, { id: 'urgent', label: 'Urgentes' },
];
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

function NoticeBadge({ notice }: { notice: Notice }) {
  const urgent = notice.priority === 'URGENT';
  return <View style={[styles.badge, urgent && styles.urgentBadge]}>
    <Ionicons name={urgent ? 'alert-circle-outline' : 'megaphone-outline'} size={spacing.lg} color={urgent ? colors.danger : colors.textSecondary} />
    <Text style={[styles.badgeText, urgent && styles.urgentText]}>{urgent ? 'Urgente' : 'Comunicado'}</Text>
  </View>;
}

function BackButton({ onPress, label }: { onPress: () => void; label: string }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.back}>
    <Ionicons name="arrow-back" size={spacing.xxl} color={colors.textOnBrand} />
  </Pressable>;
}

export function NoticesScreen({ navigation }: RootStackScreenProps<'Comunicados'>) {
  const { notices, loading, refreshing, failure, reload } = useNotices();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const unread = notices.filter((notice) => notice.isRead === false).length;
  const visible = useMemo(() => notices.filter((notice) =>
    (filter !== 'unread' || notice.isRead === false) &&
    (filter !== 'urgent' || notice.priority === 'URGENT') &&
    normalize(`${notice.title} ${notice.content}`).includes(normalize(query.trim()))
  ), [notices, query, filter]);

  return <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
    <View style={styles.hero}>
      <View style={styles.topRow}>
        <BackButton onPress={() => navigation.goBack()} label="Voltar para início" />
        <Text style={styles.overline}>VIDA EM CONDOMÍNIO</Text>
        <View style={styles.heroIcon}><Ionicons name="megaphone-outline" size={spacing.xl} color={colors.accent} /></View>
      </View>
      <Text accessibilityRole="header" style={styles.heroTitle}>Comunicados</Text>
      <Text style={styles.heroCaption}>Tudo o que você precisa saber, em um só lugar.</Text>
      <View style={styles.heroFooter}>
        <Text style={styles.heroMeta}>{loading ? 'Carregando…' : `${notices.length} publicados`}</Text>
        {!loading && unread > 0 && <View style={styles.unreadPill}><View style={styles.dot} /><Text style={styles.unreadText}>{unread} não {unread === 1 ? 'lido' : 'lidos'}</Text></View>}
      </View>
    </View>
    <FlatList
      data={visible}
      keyExtractor={(notice) => notice.id}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={colors.brand} />}
      ListHeaderComponent={<View style={styles.controls}>
        <View style={styles.search}>
          <Ionicons name="search-outline" size={spacing.xl} color={colors.textSecondary} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Buscar comunicados" accessibilityLabel="Buscar comunicados" placeholderTextColor={colors.textSecondary} style={styles.searchInput} returnKeyType="search" />
          {query ? <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Limpar busca" style={styles.clear}><Ionicons name="close-circle" size={spacing.xl} color={colors.textSecondary} /></Pressable> : null}
        </View>
        <View style={styles.filters}>{filters.map((item) => <Pressable key={item.id} onPress={() => setFilter(item.id)} accessibilityRole="button" accessibilityState={{ selected: filter === item.id }} style={[styles.filter, filter === item.id && styles.filterActive]}><Text style={[styles.filterText, filter === item.id && styles.filterActiveText]}>{item.label}</Text></Pressable>)}</View>
        {failure && <StatusBanner tone="error" title="Não foi possível atualizar" message={failure.message} actionLabel="Tentar novamente" onAction={reload} />}
        <View style={styles.sectionRow}><Text style={styles.sectionLabel}>MURAL DO CONDOMÍNIO</Text><Pressable onPress={reload} accessibilityRole="button" accessibilityLabel="Atualizar comunicados" style={styles.clear}><Ionicons name="refresh-outline" size={spacing.xl} color={colors.textSecondary} /></Pressable></View>
      </View>}
      ListEmptyComponent={loading ? <ActivityIndicator color={colors.brand} accessibilityLabel="Carregando comunicados" /> : !failure ? <View style={styles.empty}><Ionicons name="file-tray-outline" size={spacing.huge} color={colors.accent} /><Text style={styles.cardTitle}>{query || filter !== 'all' ? 'Nenhum comunicado encontrado' : 'Seu mural está tranquilo'}</Text><Text style={styles.emptyText}>{query || filter !== 'all' ? 'Experimente outra busca ou selecione Todos.' : 'Os próximos avisos do condomínio aparecerão aqui.'}</Text></View> : null}
      renderItem={({ item }) => <Pressable onPress={() => navigation.navigate('Comunicado', { notice: item })} accessibilityRole="button" accessibilityLabel={`${item.title}. ${item.priority === 'URGENT' ? 'Urgente. ' : ''}${item.isRead === false ? 'Não lido. ' : ''}Abrir comunicado`} style={({ pressed }) => [styles.card, elevation.card, item.isRead === false && styles.unreadCard, pressed && styles.pressed]}>
        <View style={styles.cardTop}><NoticeBadge notice={item} /><Text style={styles.date}>{formatDate(item.createdAt)}</Text></View>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.preview} numberOfLines={2}>{item.content}</Text>
        <View style={styles.cardFooter}><View style={styles.author}><Ionicons name="business-outline" size={spacing.lg} color={colors.textSecondary} /><Text style={styles.authorText} numberOfLines={1}>{item.author?.name ?? 'Administração'}</Text></View><View style={styles.readLink}>{item.isRead === false && <View style={styles.dot} />}<Text style={styles.linkText}>Ler aviso</Text><Ionicons name="arrow-forward" size={spacing.lg} color={colors.brand} /></View></View>
      </Pressable>}
    />
  </SafeAreaView>;
}

export function NoticeDetailScreen({ route, navigation }: RootStackScreenProps<'Comunicado'>) {
  const { notice } = route.params;
  const [read, setRead] = useState(notice.isRead === true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function confirmRead() {
    if (saving || read) return;
    setSaving(true); setError(null);
    try { await markNoticeAsRead(notice.id); setRead(true); }
    catch (failure) { setError(toApiFailure(failure, 'Não foi possível confirmar a leitura.').message); }
    finally { setSaving(false); }
  }
  return <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
    <View style={styles.detailHeader}><BackButton onPress={() => navigation.goBack()} label="Voltar para comunicados" /><Text style={styles.headerLabel}>Comunicados</Text></View>
    <ScrollView style={styles.list} contentContainerStyle={styles.articleWrap}>
      <View style={styles.article}>
        <NoticeBadge notice={notice} />
        <Text accessibilityRole="header" style={styles.articleTitle}>{notice.title}</Text>
        <Text style={styles.date}>{formatDate(notice.createdAt)}</Text>
        <View style={styles.sender}><View style={styles.senderIcon}><Ionicons name="business-outline" size={spacing.xl} color={colors.brand} /></View><View style={styles.senderCopy}><Text style={styles.senderName}>{notice.author?.name ?? 'Administração'}</Text><Text style={styles.date}>{notice.targetType === 'UNIT' ? 'Para sua unidade' : 'Para todo o condomínio'}</Text></View></View>
        <Text selectable style={styles.articleBody}>{notice.content}</Text>
      </View>
      {error && <StatusBanner tone="error" title="Leitura não confirmada" message={error} />}
      {read ? <View style={styles.readConfirmation} accessibilityLiveRegion="polite"><Ionicons name="checkmark-circle" size={spacing.xl} color={colors.success} /><Text style={styles.successText}>Leitura confirmada</Text></View> : notice.isRead === false ? <View style={styles.confirmArea}><Text style={styles.emptyText}>Confirme que você está ciente deste comunicado.</Text><Button label="Confirmar leitura" onPress={() => void confirmRead()} isLoading={saving} /></View> : null}
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
  unreadPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.brandSoft, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill },
  unreadText: { ...typography.label, color: colors.accent },
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
  unreadCard: { borderLeftWidth: spacing.xs, borderLeftColor: colors.accent },
  pressed: { opacity: 0.8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  urgentBadge: { backgroundColor: colors.dangerSoft },
  badgeText: { ...typography.labelSmall, color: colors.textSecondary },
  urgentText: { color: colors.danger },
  date: { ...typography.caption, color: colors.textSecondary },
  cardTitle: { ...typography.subtitle, color: colors.textPrimary },
  preview: { ...typography.body, color: colors.textSecondary },
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
  confirmArea: { gap: spacing.lg },
  readConfirmation: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.successSoft },
  successText: { ...typography.label, color: colors.success },
});
