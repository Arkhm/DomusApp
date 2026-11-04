import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Input, SectionHeader, StatusBanner } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { toApiFailure } from '../services/api';
import { createIncident, listIncidents } from '../services/incidentService';
import { validateIncident } from '../utils/residentForms';
import { colors, layout, radius, spacing, typography } from '../theme';
import type { Incident, IncidentCategory, IncidentStatus } from '../types';

const CATEGORIES: { value: IncidentCategory; label: string }[] = [
  { value: 'BARULHO', label: 'Barulho' }, { value: 'MANUTENCAO', label: 'Manutenção' },
  { value: 'SEGURANCA', label: 'Segurança' }, { value: 'LIMPEZA', label: 'Limpeza' },
  { value: 'OUTRO', label: 'Outro' },
];
const STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: 'Aberta', IN_PROGRESS: 'Em andamento', RESOLVED: 'Resolvida', CLOSED: 'Encerrada',
};

export function IncidentsScreen(): React.JSX.Element {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<IncidentCategory | ''>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);
  const isResident = user?.role === 'MORADOR';
  const reload = () => setRevision((value) => value + 1);

  useFocusEffect(useCallback(() => {
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    void listIncidents().then((items) => {
      if (active) setIncidents(items.filter((item) => item.author.id === user?.id));
    }).catch((error: unknown) => {
      if (active) setLoadError(toApiFailure(error, 'Não foi possível carregar as ocorrências.').message);
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [user?.id, revision]));

  async function submit(): Promise<void> {
    if (saving.current || !isResident) return;
    const error = validateIncident({ title, description, category });
    setFormError(error);
    if (error || !category) return;
    saving.current = true;
    setIsSaving(true);
    setNotice(null);
    try {
      await createIncident({ title: title.trim(), description: description.trim(), category });
      setTitle('');
      setDescription('');
      setCategory('');
      setIsFormOpen(false);
      setNotice('Ocorrência registrada. Acompanhe a resposta da administração por aqui.');
      reload();
    } catch (error) {
      setFormError(toApiFailure(error, 'Não foi possível registrar a ocorrência.').message);
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => { if (!saving.current) reload(); }} tintColor={colors.brand} colors={[colors.brand]} />}>
          <SectionHeader title="Minhas ocorrências" caption="Registre um problema e acompanhe o atendimento da administração." />
          {loadError ? <StatusBanner tone="error" title="Não foi possível atualizar" message={loadError} actionLabel="Tentar de novo" onAction={reload} /> : null}
          {notice ? <StatusBanner tone="info" title={notice} /> : null}
          {!isResident ? <StatusBanner tone="warning" title="Área do morador" message="O registro de ocorrências está disponível para contas de morador." /> : null}
          {isResident ? <Button label={isFormOpen ? 'Fechar formulário' : 'Registrar ocorrência'} variant="secondary" disabled={isSaving}
            onPress={() => { setIsFormOpen((value) => !value); setFormError(null); }} /> : null}

          {isFormOpen ? (
            <View style={styles.card}>
              <Text style={styles.title}>Nova ocorrência</Text>
              <Input label="Título (até 200 caracteres)" value={title} onChangeText={setTitle} maxLength={200} autoCapitalize="sentences" editable={!isSaving} />
              <Input label="Descrição" value={description} onChangeText={setDescription} multiline autoCapitalize="sentences" editable={!isSaving} />
              <Text style={styles.text}>Categoria</Text>
              <View accessibilityRole="radiogroup" accessibilityLabel="Categoria da ocorrência" style={styles.options}>
                {CATEGORIES.map((item) => (
                  <Pressable key={item.value} onPress={() => setCategory(item.value)} disabled={isSaving}
                    accessibilityRole="radio" accessibilityLabel={item.label} accessibilityState={{ checked: category === item.value, disabled: isSaving }}
                    style={[styles.option, category === item.value ? styles.selected : null]}>
                    <Text style={styles.text}>{category === item.value ? 'Selecionada: ' : ''}{item.label}</Text>
                  </Pressable>
                ))}
              </View>
              {formError ? <StatusBanner tone="error" title="Confira a ocorrência" message={formError} /> : null}
              <Button label="Enviar ocorrência" onPress={() => void submit()} isLoading={isSaving} />
            </View>
          ) : null}

          <Button label="Atualizar ocorrências" variant="ghost" onPress={reload} disabled={isLoading || isSaving} />
          {isLoading ? <ActivityIndicator color={colors.brand} accessibilityLabel="Carregando ocorrências" /> : null}
          {!isLoading && !loadError && incidents.length === 0 ? <Text style={styles.text}>Você ainda não registrou ocorrências.</Text> : null}
          {incidents.map((incident) => (
            <View key={incident.id} style={styles.card}>
              <Text style={styles.title}>{incident.title}</Text>
              <Text style={styles.text}>Categoria: {CATEGORIES.find((item) => item.value === incident.category)?.label ?? incident.category}</Text>
              <Text style={styles.status}>Status: {STATUS_LABELS[incident.status]}</Text>
              <Text style={styles.text}>{incident.description}</Text>
              <Text style={styles.text}>{incident.response ? `Resposta da administração: ${incident.response}` : 'Aguardando resposta da administração.'}</Text>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
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
