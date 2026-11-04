import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Button, ConfirmSheet, Input, SectionHeader, StatusBanner } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { toApiFailure } from '../services/api';
import { listCommonAreas } from '../services/commonAreaService';
import { cancelReservation, createReservation, listReservations } from '../services/reservationService';
import { canCancelReservation, formatReservationDate, validateReservation } from '../utils/residentForms';
import { colors, layout, radius, spacing, typography } from '../theme';
import type { CommonArea, Reservation, ReservationStatus } from '../types';

const STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING: 'Aguardando aprovação', APPROVED: 'Aprovada',
  REJECTED: 'Rejeitada', CANCELLED: 'Cancelada',
};

export function ReservationsScreen(): React.JSX.Element {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [areas, setAreas] = useState<CommonArea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [commonAreaId, setCommonAreaId] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);
  const [toCancel, setToCancel] = useState<Reservation | null>(null);
  const isResident = user?.role === 'MORADOR';
  const selectedArea = areas.find((area) => area.id === commonAreaId);
  const reload = () => setRevision((value) => value + 1);

  useFocusEffect(useCallback(() => {
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    void Promise.all([listReservations(), listCommonAreas()]).then(([items, commonAreas]) => {
      if (!active) return;
      // Síndicos recebem todos os registros; este canal mostra apenas os próprios.
      setReservations(items.filter((item) => item.user.id === user?.id));
      setAreas(commonAreas.filter((area) => area.isActive));
    }).catch((error: unknown) => {
      if (active) setLoadError(toApiFailure(error, 'Não foi possível carregar as reservas.').message);
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [user?.id, revision]));

  async function submit(): Promise<void> {
    if (saving.current || !isResident) return;
    const input = { commonAreaId, date: date.trim(), startTime: startTime.trim(), endTime: endTime.trim() };
    const error = validateReservation(input);
    setFormError(error);
    if (error) return;
    if (!selectedArea || loadError || isLoading) {
      setFormError('Atualize a lista e escolha uma área comum ativa.');
      return;
    }
    saving.current = true;
    setIsSaving(true);
    setNotice(null);
    setActionError(null);
    try {
      await createReservation(input);
      setIsFormOpen(false);
      setCommonAreaId('');
      setDate('');
      setStartTime('');
      setEndTime('');
      setNotice('Reserva solicitada. Aguarde a aprovação da administração.');
      reload();
    } catch (error) {
      setFormError(toApiFailure(error, 'Não foi possível solicitar a reserva.').message);
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  async function confirmCancellation(): Promise<void> {
    const reservation = toCancel;
    setToCancel(null);
    if (!reservation || saving.current || !isResident || !user) return;
    setActionError(null);
    setNotice(null);
    if (!canCancelReservation(reservation, user.id)) {
      setActionError('Esta reserva não pode mais ser cancelada. Atualize a lista.');
      return;
    }
    saving.current = true;
    setIsSaving(true);
    try {
      await cancelReservation(reservation.id);
      setNotice('Reserva cancelada.');
      reload();
    } catch (error) {
      setActionError(toApiFailure(error, 'Não foi possível cancelar a reserva.').message);
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => { if (!saving.current) reload(); }} tintColor={colors.brand} colors={[colors.brand]} />}>
          <SectionHeader title="Minhas reservas" caption="Solicite uma área comum e acompanhe a aprovação. Horários de Brasília (UTC-03)." />
          {loadError ? <StatusBanner tone="error" title="Não foi possível atualizar" message={loadError} actionLabel="Tentar de novo" onAction={reload} /> : null}
          {actionError ? <StatusBanner tone="error" title="Não foi possível cancelar" message={actionError} /> : null}
          {notice ? <StatusBanner tone="info" title={notice} /> : null}
          {!isResident ? <StatusBanner tone="warning" title="Área do morador" message="Solicitações e cancelamentos estão disponíveis para contas de morador." /> : null}
          {isResident ? <Button label={isFormOpen ? 'Fechar formulário' : 'Nova reserva'} variant="secondary" disabled={isSaving}
            onPress={() => { setIsFormOpen((value) => !value); setFormError(null); }} /> : null}

          {isFormOpen ? (
            <View style={styles.card}>
              <Text style={styles.title}>Nova reserva</Text>
              <Text style={styles.text}>Escolha uma área ativa</Text>
              {isLoading ? <ActivityIndicator color={colors.brand} accessibilityLabel="Carregando áreas comuns" /> : null}
              {!isLoading && !loadError && areas.length === 0 ? <Text style={styles.text}>Nenhuma área comum ativa disponível.</Text> : null}
              <View accessibilityRole="radiogroup" accessibilityLabel="Áreas comuns" style={styles.options}>
                {areas.map((area) => (
                  <Pressable key={area.id} onPress={() => setCommonAreaId(area.id)} disabled={isSaving || isLoading || Boolean(loadError)}
                    accessibilityRole="radio" accessibilityLabel={area.name}
                    accessibilityState={{ checked: commonAreaId === area.id, disabled: isSaving || isLoading || Boolean(loadError) }}
                    style={[styles.option, commonAreaId === area.id ? styles.selected : null]}>
                    <Text style={styles.text}>{commonAreaId === area.id ? 'Selecionada: ' : ''}{area.name}</Text>
                  </Pressable>
                ))}
              </View>
              {selectedArea ? <View style={styles.options}>
                {selectedArea.description ? <Text style={styles.text}>{selectedArea.description}</Text> : null}
                {selectedArea.capacity !== null ? <Text style={styles.text}>Capacidade: {selectedArea.capacity} pessoas</Text> : null}
                {selectedArea.rules ? <Text style={styles.text}>Regras: {selectedArea.rules}</Text> : null}
              </View> : null}
              <Input label="Data (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-12-31" maxLength={10} editable={!isSaving} />
              <Input label="Início (HH:mm)" value={startTime} onChangeText={setStartTime} placeholder="14:00" maxLength={5} editable={!isSaving} />
              <Input label="Fim (HH:mm)" value={endTime} onChangeText={setEndTime} placeholder="16:00" maxLength={5} editable={!isSaving} />
              {formError ? <StatusBanner tone="error" title="Confira a solicitação" message={formError} /> : null}
              <Button label="Solicitar reserva" onPress={() => void submit()} isLoading={isSaving} disabled={isLoading || Boolean(loadError) || areas.length === 0} />
            </View>
          ) : null}

          <Button label="Atualizar reservas" variant="ghost" onPress={reload} disabled={isLoading || isSaving} />
          {isLoading ? <ActivityIndicator color={colors.brand} accessibilityLabel="Carregando reservas" /> : null}
          {!isLoading && !loadError && reservations.length === 0 ? <Text style={styles.text}>Você ainda não tem reservas.</Text> : null}
          {reservations.map((reservation) => (
            <View key={reservation.id} style={styles.card}>
              <Text style={styles.title}>{reservation.commonArea.name}</Text>
              <Text style={styles.text}>{formatReservationDate(reservation.date)} · {reservation.startTime} às {reservation.endTime} (Brasília)</Text>
              <Text style={styles.status}>Status: {STATUS_LABELS[reservation.status]}</Text>
              {reservation.rejectionReason ? <Text style={styles.text}>Motivo da rejeição: {reservation.rejectionReason}</Text> : null}
              {isResident && user && canCancelReservation(reservation, user.id) ? <Button label="Cancelar reserva" variant="secondary"
                accessibilityLabel={`Cancelar reserva de ${reservation.commonArea.name} em ${formatReservationDate(reservation.date)}`}
                disabled={isSaving} onPress={() => setToCancel(reservation)} /> : null}
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
      <ConfirmSheet visible={Boolean(toCancel)} title="Cancelar reserva?"
        message={toCancel ? `${toCancel.commonArea.name} · ${formatReservationDate(toCancel.date)}, das ${toCancel.startTime} às ${toCancel.endTime} (Brasília).` : undefined}
        confirmLabel="Confirmar cancelamento" cancelLabel="Manter reserva"
        onConfirm={() => void confirmCancellation()} onCancel={() => setToCancel(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: layout.screenPadding, gap: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  title: { ...typography.subtitle, color: colors.textPrimary },
  text: { ...typography.body, color: colors.textSecondary },
  status: { ...typography.bodyStrong, color: colors.brand },
  options: { gap: spacing.sm },
  option: { minHeight: layout.minTouchTarget, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  selected: { borderColor: colors.brand, backgroundColor: colors.surfaceMuted },
});
