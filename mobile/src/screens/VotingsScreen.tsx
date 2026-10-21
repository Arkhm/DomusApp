import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, ConfirmSheet, StatusBanner } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { useVotings } from '../hooks/useVotings';
import { castVote } from '../services/votingService';
import { toApiFailure } from '../services/api';
import { colors, elevation, layout, radius, spacing, typography } from '../theme';
import { formatDateTime, relativeDay } from '../utils/format';
import type { RootStackScreenProps, Voting, VotingStatus } from '../types';

type Filter = 'active' | 'closed' | 'all';
const filters: { id: Filter; label: string }[] = [
  { id: 'active', label: 'Em andamento' }, { id: 'closed', label: 'Encerradas' }, { id: 'all', label: 'Todas' },
];
const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const STATUS_META: Record<VotingStatus, { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  OPEN: { label: 'Aberta', icon: 'radio-button-on-outline' },
  SCHEDULED: { label: 'Agendada', icon: 'time-outline' },
  CLOSED: { label: 'Encerrada', icon: 'lock-closed-outline' },
};

/** "hoje", "amanhã", "em 3 dias"… — nunca "já aconteceu" para um prazo que o servidor ainda considera aberto. */
function relativeLabel(prefix: string, isoDate: string, fallback: string) {
  const relative = relativeDay(isoDate);
  if (!relative || relative === 'Já aconteceu') return fallback;
  return `${prefix} ${relative.charAt(0).toLowerCase()}${relative.slice(1)}`;
}

function timingOf(voting: Voting) {
  if (voting.status === 'OPEN') {
    return { chip: relativeLabel('Encerra', voting.endDate, 'Encerrando agora'), line: `Até ${formatDateTime(voting.endDate)}` };
  }
  if (voting.status === 'SCHEDULED') {
    return { chip: relativeLabel('Começa', voting.startDate, 'Começando agora'), line: `A partir de ${formatDateTime(voting.startDate)}` };
  }
  return { chip: formatDateTime(voting.endDate), line: `Encerrada em ${formatDateTime(voting.endDate)}` };
}

function StatusBadge({ status }: { status: VotingStatus }) {
  const meta = STATUS_META[status];
  const open = status === 'OPEN';
  return <View style={[styles.badge, open && styles.openBadge]}>
    <Ionicons name={meta.icon} size={spacing.lg} color={open ? colors.success : colors.textSecondary} />
    <Text style={[styles.badgeText, open && styles.openText]}>{meta.label}</Text>
  </View>;
}

function BackButton({ onPress, label }: { onPress: () => void; label: string }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.back}>
    <Ionicons name="arrow-back" size={spacing.xxl} color={colors.textOnBrand} />
  </Pressable>;
}

export function VotingsScreen({ navigation }: RootStackScreenProps<'Votacoes'>) {
  const { votings, loading, refreshing, failure, reload } = useVotings();
  const { user } = useAuth();
  const canVote = user?.role === 'MORADOR';
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const openCount = votings.filter((voting) => voting.status === 'OPEN').length;
  const waiting = canVote ? votings.filter((voting) => voting.status === 'OPEN' && !voting.hasVoted).length : 0;
  const visible = useMemo(() => votings.filter((voting) =>
    (filter !== 'active' || voting.status !== 'CLOSED') &&
    (filter !== 'closed' || voting.status === 'CLOSED') &&
    normalize(`${voting.title} ${voting.description}`).includes(normalize(query.trim()))
  ), [votings, query, filter]);

  return <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
    <View style={styles.hero}>
      <View style={styles.topRow}>
        <BackButton onPress={() => navigation.goBack()} label="Voltar para início" />
        <Text style={styles.overline}>VIDA EM CONDOMÍNIO</Text>
        <View style={styles.heroIcon}><Ionicons name="checkbox-outline" size={spacing.xl} color={colors.accent} /></View>
      </View>
      <Text accessibilityRole="header" style={styles.heroTitle}>Votações</Text>
      <Text style={styles.heroCaption}>Sua voz nas decisões do condomínio.</Text>
      <View style={styles.heroFooter}>
        <Text style={styles.heroMeta}>{loading ? 'Carregando…' : `${openCount} ${openCount === 1 ? 'aberta' : 'abertas'}`}</Text>
        {!loading && waiting > 0 && <View style={styles.waitingPill}><View style={styles.dot} /><Text style={styles.waitingText}>{waiting} {waiting === 1 ? 'aguarda' : 'aguardam'} seu voto</Text></View>}
      </View>
    </View>
    <FlatList
      data={visible}
      keyExtractor={(voting) => voting.id}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={colors.brand} />}
      ListHeaderComponent={<View style={styles.controls}>
        <View style={styles.search}>
          <Ionicons name="search-outline" size={spacing.xl} color={colors.textSecondary} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Buscar votações" accessibilityLabel="Buscar votações" placeholderTextColor={colors.textSecondary} style={styles.searchInput} returnKeyType="search" />
          {query ? <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Limpar busca" style={styles.clear}><Ionicons name="close-circle" size={spacing.xl} color={colors.textSecondary} /></Pressable> : null}
        </View>
        <View style={styles.filters}>{filters.map((item) => <Pressable key={item.id} onPress={() => setFilter(item.id)} accessibilityRole="button" accessibilityState={{ selected: filter === item.id }} style={[styles.filter, filter === item.id && styles.filterActive]}><Text style={[styles.filterText, filter === item.id && styles.filterActiveText]}>{item.label}</Text></Pressable>)}</View>
        {failure && <StatusBanner tone="error" title="Não foi possível atualizar" message={failure.message} actionLabel="Tentar novamente" onAction={reload} />}
        <View style={styles.sectionRow}><Text style={styles.sectionLabel}>DECISÕES DO CONDOMÍNIO</Text><Pressable onPress={reload} accessibilityRole="button" accessibilityLabel="Atualizar votações" style={styles.clear}><Ionicons name="refresh-outline" size={spacing.xl} color={colors.textSecondary} /></Pressable></View>
      </View>}
      ListEmptyComponent={loading ? <ActivityIndicator color={colors.brand} accessibilityLabel="Carregando votações" /> : !failure ? <View style={styles.empty}><Ionicons name="file-tray-outline" size={spacing.huge} color={colors.accent} /><Text style={styles.cardTitle}>{query || filter !== 'active' ? 'Nenhuma votação encontrada' : 'Nenhuma votação em andamento'}</Text><Text style={styles.emptyText}>{query || filter !== 'active' ? 'Experimente outra busca ou selecione Todas.' : 'As próximas votações do condomínio aparecerão aqui.'}</Text></View> : null}
      renderItem={({ item }) => {
        const timing = timingOf(item);
        const needsVote = canVote && item.status === 'OPEN' && !item.hasVoted;
        const action = needsVote ? 'Votar' : item.status === 'CLOSED' ? 'Ver resultado' : 'Ver detalhes';
        return <Pressable onPress={() => navigation.navigate('Votacao', { voting: item })} accessibilityRole="button" accessibilityLabel={`${item.title}. ${STATUS_META[item.status].label}. ${item.hasVoted ? 'Você já votou. ' : ''}${needsVote ? 'Aguardando seu voto. ' : ''}${timing.line}. Abrir votação`} style={({ pressed }) => [styles.card, elevation.card, needsVote && styles.needsVoteCard, pressed && styles.pressed]}>
          <View style={styles.cardTop}><StatusBadge status={item.status} /><Text style={styles.date}>{timing.chip}</Text></View>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.preview} numberOfLines={2}>{item.description}</Text>
          {item.hasVoted && <View style={styles.votedPill}><Ionicons name="checkmark-circle" size={spacing.lg} color={colors.success} /><Text style={styles.votedText}>Você votou</Text></View>}
          {needsVote && <View style={styles.pendingPill}><View style={styles.dot} /><Text style={styles.pendingText}>Aguardando seu voto</Text></View>}
          <View style={styles.cardFooter}><Text style={styles.authorText} numberOfLines={1}>{timing.line}</Text><View style={styles.readLink}><Text style={styles.linkText}>{action}</Text><Ionicons name="arrow-forward" size={spacing.lg} color={colors.brand} /></View></View>
        </Pressable>;
      }}
    />
  </SafeAreaView>;
}

function ChoiceRow({ text, selected, onPress }: { text: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={text} style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && styles.pressed]}>
    <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={spacing.xxl} color={selected ? colors.brand : colors.textSecondary} />
    <Text style={[styles.choiceText, selected && styles.choiceSelectedText]}>{text}</Text>
  </Pressable>;
}

function PlainRow({ text, mine }: { text: string; mine: boolean }) {
  return <View style={[styles.choice, mine && styles.choiceSelected]} accessible accessibilityLabel={mine ? `${text}. Seu voto` : text}>
    <Ionicons name={mine ? 'checkmark-circle' : 'ellipse-outline'} size={spacing.xxl} color={mine ? colors.success : colors.textMuted} />
    <Text style={[styles.choiceText, mine && styles.choiceSelectedText]}>{text}</Text>
    {mine && <Text style={styles.mineTag}>Seu voto</Text>}
  </View>;
}

function ResultRow({ text, votes, total, leading, mine }: { text: string; votes: number; total: number; leading: boolean; mine: boolean }) {
  const percent = total > 0 ? Math.round((votes / total) * 100) : 0;
  return <View style={styles.result} accessible accessibilityLabel={`${text}: ${votes} ${votes === 1 ? 'voto' : 'votos'}, ${percent} por cento${mine ? '. Seu voto' : ''}${leading ? '. Opção mais votada' : ''}`}>
    <View style={styles.resultTop}>
      <Text style={[styles.resultText, leading && styles.resultLeading]} numberOfLines={2}>{text}</Text>
      {mine && <Text style={styles.mineTag}>Seu voto</Text>}
    </View>
    <View style={styles.track}><View style={[styles.fill, leading && styles.fillLeading, { width: `${percent}%` }]} /></View>
    <Text style={styles.date}>{votes} {votes === 1 ? 'voto' : 'votos'} · {percent}%</Text>
  </View>;
}

export function VotingDetailScreen({ route, navigation }: RootStackScreenProps<'Votacao'>) {
  const { voting } = route.params;
  const { user } = useAuth();
  const canVote = user?.role === 'MORADOR';
  const [myOptionId, setMyOptionId] = useState<string | null>(voting.myOptionId);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedOption = voting.options.find((option) => option.id === selected);
  const voted = myOptionId !== null;
  const total = voting.options.reduce((sum, option) => sum + (option.votes ?? 0), 0);
  const topVotes = Math.max(0, ...voting.options.map((option) => option.votes ?? 0));
  const showResults = voting.status === 'CLOSED' && voting.options.every((option) => typeof option.votes === 'number');

  async function submitVote() {
    if (!selected || saving) return;
    setConfirming(false); setSaving(true); setError(null);
    try { await castVote(voting.id, selected); setMyOptionId(selected); }
    catch (failure) { setError(toApiFailure(failure, 'Não foi possível registrar seu voto.').message); }
    finally { setSaving(false); }
  }

  return <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
    <View style={styles.detailHeader}><BackButton onPress={() => navigation.goBack()} label="Voltar para votações" /><Text style={styles.headerLabel}>Votações</Text></View>
    <ScrollView style={styles.list} contentContainerStyle={styles.articleWrap}>
      <View style={styles.article}>
        <StatusBadge status={voting.status} />
        <Text accessibilityRole="header" style={styles.articleTitle}>{voting.title}</Text>
        <Text style={styles.date}>{formatDateTime(voting.startDate)} até {formatDateTime(voting.endDate)}</Text>
        <View style={styles.sender}><View style={styles.senderIcon}><Ionicons name="business-outline" size={spacing.xl} color={colors.brand} /></View><View style={styles.senderCopy}><Text style={styles.senderName}>{voting.author?.name ?? 'Administração'}</Text><Text style={styles.date}>Voto por morador · um voto cada</Text></View></View>
        <Text selectable style={styles.articleBody}>{voting.description}</Text>
      </View>

      <View style={styles.optionsBlock}>
        <Text style={styles.sectionLabel}>{showResults ? 'RESULTADO' : 'OPÇÕES'}</Text>
        {showResults
          ? <>
              {voting.options.map((option) => <ResultRow key={option.id} text={option.text} votes={option.votes ?? 0} total={total} leading={total > 0 && (option.votes ?? 0) === topVotes} mine={option.id === myOptionId} />)}
              <Text style={styles.emptyText}>{total} {total === 1 ? 'voto no total' : 'votos no total'}</Text>
            </>
          : voting.status === 'OPEN' && canVote && !voted
            ? voting.options.map((option) => <ChoiceRow key={option.id} text={option.text} selected={option.id === selected} onPress={() => setSelected(option.id)} />)
            : voting.options.map((option) => <PlainRow key={option.id} text={option.text} mine={option.id === myOptionId} />)}
      </View>

      {error && <StatusBanner tone="error" title="Voto não registrado" message={error} />}

      {voting.status === 'OPEN' && canVote && !voted && <View style={styles.confirmArea}>
        <Text style={styles.emptyText}>Escolha uma opção. Depois de confirmado, o voto não pode ser alterado.</Text>
        <Button label="Votar" onPress={() => setConfirming(true)} disabled={!selected} isLoading={saving} />
      </View>}
      {voting.status === 'OPEN' && voted && <View style={styles.votedBanner} accessibilityLiveRegion="polite">
        <Ionicons name="checkmark-circle" size={spacing.xl} color={colors.success} />
        <Text style={styles.votedBannerText}>Voto registrado. O resultado será divulgado quando a votação encerrar, em {formatDateTime(voting.endDate)}.</Text>
      </View>}
      {voting.status === 'OPEN' && !canVote && <Text style={styles.emptyText}>Somente moradores podem votar.</Text>}
      {voting.status === 'SCHEDULED' && <Text style={styles.emptyText}>Esta votação começa em {formatDateTime(voting.startDate)}.</Text>}
      {voting.status === 'CLOSED' && !voted && canVote && <Text style={styles.emptyText}>Você não votou nesta votação.</Text>}
    </ScrollView>
    <ConfirmSheet
      visible={confirming}
      title="Confirmar seu voto?"
      message={selectedOption ? `Você votará em “${selectedOption.text}”. Depois de confirmado, o voto não pode ser alterado.` : undefined}
      confirmLabel="Confirmar voto"
      onConfirm={() => void submitVote()}
      onCancel={() => setConfirming(false)}
    />
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
  waitingPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.brandSoft, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill },
  waitingText: { ...typography.label, color: colors.accent },
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
  needsVoteCard: { borderLeftWidth: spacing.xs, borderLeftColor: colors.accent },
  pressed: { opacity: 0.8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  openBadge: { backgroundColor: colors.successSoft },
  badgeText: { ...typography.labelSmall, color: colors.textSecondary },
  openText: { color: colors.success },
  date: { ...typography.caption, color: colors.textSecondary },
  cardTitle: { ...typography.subtitle, color: colors.textPrimary },
  preview: { ...typography.body, color: colors.textSecondary },
  votedPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.successSoft },
  votedText: { ...typography.labelSmall, color: colors.success },
  pendingPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.accentSoft },
  pendingText: { ...typography.labelSmall, color: colors.textPrimary },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
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
  optionsBlock: { gap: spacing.md },
  choice: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: layout.minTouchTarget + spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  choiceSelected: { borderColor: colors.brand, backgroundColor: colors.surfaceMuted },
  choiceText: { ...typography.bodyStrong, flex: 1, color: colors.textPrimary },
  choiceSelectedText: { color: colors.brand },
  mineTag: { ...typography.labelSmall, color: colors.success },
  result: { gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  resultTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  resultText: { ...typography.bodyStrong, flex: 1, color: colors.textPrimary },
  resultLeading: { color: colors.brand },
  track: { height: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.borderStrong },
  fillLeading: { backgroundColor: colors.brand },
  confirmArea: { gap: spacing.lg },
  votedBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.successSoft },
  votedBannerText: { ...typography.label, flex: 1, color: colors.success },
});
