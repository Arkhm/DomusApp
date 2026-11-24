import React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, SectionHeader, StatusBanner, SummaryTile } from '../components';
import { useInvoices } from '../hooks/useInvoices';
import { colors, layout, radius, spacing, typography } from '../theme';
import { INVOICE_TYPE_LABELS, formatInvoiceDate, invoiceStatusLabel, isInvoiceOverdue } from '../types/invoice';
import type { InvoiceFilter, InvoiceStackParamList } from '../types/invoice';
import { formatMoney } from '../utils/money';

const FILTERS: { value: InvoiceFilter; label: string }[] = [
  { value: 'open', label: 'Abertas' }, { value: 'paid', label: 'Pagas' }, { value: 'all', label: 'Todas' },
];

export function InvoicesScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<InvoiceStackParamList>>();
  const { invoices, stats, filter, setFilter, isLoading, isLoadingMore, error, statsError, moreError, hasMore, reload, loadMore } = useInvoices();
  const sortedInvoices = [...invoices].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={reload} tintColor={colors.brand} colors={[colors.brand]} />}>
        <SectionHeader title="Minhas cobranças" caption="Consulte suas faturas e os dados para pagamento." />
        {statsError ? <StatusBanner tone="error" title="Resumo indisponível" message={statsError} actionLabel="Tentar de novo" onAction={reload} /> : null}
        {stats ? <View style={styles.summary}>
          <SummaryTile icon="wallet-outline" label="Em aberto" value={String(stats.pending)} detail={formatMoney(stats.pendingAmount)} />
          <View style={styles.summaryRow}>
            <SummaryTile icon="alert-circle-outline" label="Vencidas" value={String(stats.overdue)} />
            <SummaryTile icon="checkmark-circle-outline" label="Pagas" value={String(stats.paid)} />
          </View>
          <Text style={styles.caption}>As faturas pendentes em atraso também aparecem em vencidas.</Text>
        </View> : null}
        <View accessibilityRole="radiogroup" accessibilityLabel="Filtrar cobranças" style={styles.filters}>
          {FILTERS.map((option) => <Pressable key={option.value} onPress={() => setFilter(option.value)}
            accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: filter === option.value }}
            style={[styles.filter, filter === option.value ? styles.selected : null]}>
            <Text style={styles.filterLabel}>{option.label}</Text>
          </Pressable>)}
        </View>
        {error ? <StatusBanner tone="error" title="Não foi possível atualizar" message={error} actionLabel="Tentar de novo" onAction={reload} /> : null}
        {isLoading ? <ActivityIndicator color={colors.brand} accessibilityLabel="Carregando cobranças" /> : null}
        {!isLoading && !error && invoices.length === 0 ? <Text style={styles.text}>Nenhuma cobrança encontrada neste filtro.</Text> : null}
        {sortedInvoices.map((invoice) => <View key={invoice.id} style={styles.card}>
          <Text style={styles.title}>{invoice.description}</Text>
          <Text style={styles.amount}>{formatMoney(invoice.amount)}</Text>
          <Text style={styles.text}>{INVOICE_TYPE_LABELS[invoice.type] ?? 'Cobrança'}</Text>
          <Text style={styles.text}>Vencimento: {formatInvoiceDate(invoice.dueDate)}</Text>
          <Text style={[styles.badge, isInvoiceOverdue(invoice) ? styles.overdue : invoice.status === 'PAID' ? styles.paid : null]}>
            {invoiceStatusLabel(invoice)}
          </Text>
          <Button label="Ver fatura" variant="secondary" accessibilityLabel={`Ver fatura: ${invoice.description}, ${formatMoney(invoice.amount)}`}
            onPress={() => navigation.navigate('FaturaDetalhe', { invoiceId: invoice.id })} />
        </View>)}
        {moreError ? <StatusBanner tone="error" title="Não foi possível carregar mais" message={moreError} /> : null}
        {hasMore ? <Button label={moreError ? 'Tentar carregar mais' : 'Carregar mais'} variant="secondary"
          isLoading={isLoadingMore} disabled={isLoading} onPress={() => void loadMore()} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, gap: spacing.xl },
  summary: { gap: spacing.md },
  summaryRow: { flexDirection: 'row', gap: spacing.md },
  caption: { ...typography.caption, color: colors.textSecondary },
  filters: { flexDirection: 'row', gap: spacing.sm },
  filter: { flex: 1, minHeight: layout.minTouchTarget, justifyContent: 'center', alignItems: 'center', padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  selected: { borderColor: colors.brand, backgroundColor: colors.surfaceMuted },
  filterLabel: { ...typography.bodyStrong, color: colors.brand },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  title: { ...typography.subtitle, color: colors.textPrimary },
  amount: { ...typography.title, color: colors.textPrimary },
  text: { ...typography.body, color: colors.textSecondary },
  badge: { ...typography.bodyStrong, color: colors.brand, backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignSelf: 'flex-start' },
  overdue: { color: colors.danger, backgroundColor: colors.dangerSoft },
  paid: { color: colors.success, backgroundColor: colors.successSoft },
});
