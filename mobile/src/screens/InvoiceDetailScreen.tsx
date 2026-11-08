import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { Button, SectionHeader, StatusBanner } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { toApiFailure } from '../services/api';
import { getInvoice } from '../services/invoiceService';
import { colors, layout, radius, spacing, typography } from '../theme';
import { canPayInvoice, formatInvoiceDate, INVOICE_TYPE_LABELS, invoiceStatusLabel, invoiceTicketUrl, isInvoiceOverdue } from '../types/invoice';
import type { Invoice, InvoiceStackParamList } from '../types/invoice';
import { formatMoney } from '../utils/money';

export function InvoiceDetailScreen(): React.JSX.Element {
  const { params } = useRoute<RouteProp<InvoiceStackParamList, 'FaturaDetalhe'>>();
  const invoiceId = params?.invoiceId;
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [qrError, setQrError] = useState(false);
  const [paymentExpired, setPaymentExpired] = useState(false);
  const reload = () => setRevision((value) => value + 1);

  useFocusEffect(useCallback(() => {
    let active = true;
    setIsLoading(true);
    setInvoice(null);
    setLoadError(null);
    setActionError(null);
    setNotice(null);
    setQrError(false);
    if (typeof invoiceId !== 'string' || !invoiceId) {
      setLoadError('Fatura inválida. Volte para a lista de cobranças.');
      setIsLoading(false);
      return () => { active = false; };
    }
    void getInvoice(invoiceId).then((result) => {
      if (!active) return;
      if (result.userId !== user?.id) {
        setLoadError('Esta fatura não pertence à sua conta.');
        return;
      }
      setInvoice(result);
    }).catch((error: unknown) => {
      if (active) setLoadError(toApiFailure(error, 'Não foi possível carregar a fatura.').message);
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [invoiceId, user?.id, revision]));

  useEffect(() => {
    setPaymentExpired(false);
    if (!invoice?.paymentExpiresAt) return;
    const remaining = new Date(invoice.paymentExpiresAt).getTime() - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) {
      setPaymentExpired(true);
      return;
    }
    // Evita manter QR/código visíveis após o prazo informado pelo provedor.
    const timer = setTimeout(() => setPaymentExpired(true), Math.min(remaining + 1, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [invoice]);

  const canPay = invoice !== null && !paymentExpired && canPayInvoice(invoice);
  const pixCode = canPay ? invoice.paymentData.qrCode : null;
  const qrBase64 = canPay ? invoice.paymentData.qrCodeBase64?.replace(/^data:image\/png;base64,/, '') : null;
  const qrUri = qrBase64 && /^[A-Za-z0-9+/=\r\n]+$/.test(qrBase64) ? `data:image/png;base64,${qrBase64}` : null;
  const ticketUrl = canPay ? invoice.paymentData.ticketUrl : null;

  async function copyPix(): Promise<void> {
    setNotice(null);
    setActionError(null);
    if (!invoice || !canPayInvoice(invoice) || !pixCode) {
      setActionError('Este Pix não está mais disponível. Atualize a fatura.');
      return;
    }
    try {
      const copied = await Clipboard.setStringAsync(pixCode);
      if (!copied) throw new Error('Clipboard indisponível');
      setNotice('Código Pix copiado. Confira o valor e o destinatário no aplicativo do seu banco.');
    } catch {
      setActionError('Não foi possível copiar. Você pode selecionar o código Pix abaixo para copiá-lo.');
    }
  }

  async function openTicket(): Promise<void> {
    setActionError(null);
    if (!invoice || !canPayInvoice(invoice) || !ticketUrl) {
      setActionError('Este link não está mais disponível. Atualize a fatura.');
      return;
    }
    const url = invoiceTicketUrl(ticketUrl);
    if (!url) {
      setActionError('O link de pagamento recebido é inválido. Procure a administração.');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      setActionError('Não foi possível abrir o link de pagamento. Tente novamente.');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={reload} tintColor={colors.brand} colors={[colors.brand]} />}>
        <SectionHeader title="Detalhe da fatura" caption="Acompanhe o status e consulte os dados de pagamento." />
        {loadError ? <StatusBanner tone="error" title="Não foi possível carregar" message={loadError} actionLabel="Tentar de novo" onAction={reload} /> : null}
        {isLoading ? <ActivityIndicator color={colors.brand} accessibilityLabel="Carregando fatura" /> : null}
        {invoice ? <>
          <View style={styles.card}>
            <Text style={styles.title}>{invoice.description}</Text>
            <Text style={styles.amount}>{formatMoney(invoice.amount)}</Text>
            <Text style={[styles.status, isInvoiceOverdue(invoice) ? styles.overdue : invoice.status === 'PAID' ? styles.paid : null]}>{invoiceStatusLabel(invoice)}</Text>
            <Text style={styles.text}>Tipo: {INVOICE_TYPE_LABELS[invoice.type] ?? 'Cobrança'}</Text>
            <Text style={styles.text}>Vencimento: {formatInvoiceDate(invoice.dueDate)}</Text>
            {invoice.referenceMonth ? <Text style={styles.text}>Referência: {formatInvoiceDate(invoice.referenceMonth)}</Text> : null}
            {invoice.paidAt ? <Text style={styles.text}>Pagamento registrado em {formatInvoiceDate(invoice.paidAt)}</Text> : null}
          </View>
          {invoice.requiresReview ? <StatusBanner tone="warning" title="Pagamento em conferência" message="Procure a administração antes de realizar outro pagamento." /> : null}
          {invoice.paymentEnvironment === 'TEST' ? <StatusBanner tone="warning" title="Ambiente de teste" message="Estes dados de pagamento são de teste." /> : null}
          {actionError ? <StatusBanner tone="error" title="Não foi possível concluir" message={actionError} /> : null}
          {notice ? <StatusBanner tone="info" title="Código copiado" message={notice} /> : null}
          {canPay && (pixCode || qrBase64 || ticketUrl) ? <View style={styles.card}>
            <Text style={styles.title}>Pagamento</Text>
            {invoice.paymentAmount ? <Text style={styles.text}>Valor do Pix: {formatMoney(invoice.paymentAmount)}</Text> : null}
            {invoice.paymentExpiresAt ? <Text style={styles.text}>Pix válido até {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(invoice.paymentExpiresAt))} (Brasília)</Text> : null}
            {qrUri && !qrError ? <Image source={{ uri: qrUri }} style={styles.qr} resizeMode="contain" accessibilityLabel="QR Code Pix da fatura" onError={() => setQrError(true)} /> : null}
            {(qrBase64 && !qrUri) || qrError ? <Text style={styles.text}>Não foi possível exibir o QR Code. Use o código Pix ou o link de pagamento.</Text> : null}
            {pixCode ? <>
              <Button label="Copiar código Pix" onPress={() => void copyPix()} />
              <Text selectable style={styles.pixCode} accessibilityLabel={`Código Pix copia e cola: ${pixCode}`}>{pixCode}</Text>
            </> : null}
            {ticketUrl ? <Button label="Abrir link de pagamento" variant="secondary" accessibilityHint="Abre a página de pagamento no navegador" onPress={() => void openTicket()} /> : null}
          </View> : ['PENDING', 'OVERDUE'].includes(invoice.status) && !invoice.requiresReview
            ? <StatusBanner tone="info" title="Dados de pagamento indisponíveis" message="Atualize a fatura. Se o Pix continuar indisponível ou expirado, procure a administração." /> : null}
          <Button label="Atualizar fatura" variant="ghost" onPress={reload} disabled={isLoading} />
        </> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, gap: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  title: { ...typography.subtitle, color: colors.textPrimary },
  amount: { ...typography.title, color: colors.textPrimary },
  text: { ...typography.body, color: colors.textSecondary },
  status: { ...typography.bodyStrong, color: colors.brand },
  overdue: { color: colors.danger },
  paid: { color: colors.success },
  pixCode: { ...typography.caption, color: colors.textPrimary },
  qr: { width: '100%', aspectRatio: 1, maxWidth: layout.contentMaxWidth, alignSelf: 'center', backgroundColor: colors.surface },
});
