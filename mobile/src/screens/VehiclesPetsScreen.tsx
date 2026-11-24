import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ConfirmSheet, SectionHeader, StatusBanner } from '../components';
import { VehicleForm } from '../components/VehicleForm';
import { PetForm } from '../components/PetForm';
import { useAuth } from '../contexts/AuthContext';
import { useVehicles } from '../hooks/useVehicles';
import { usePets } from '../hooks/usePets';
import { toApiFailure } from '../services/api';
import { createVehicle, deleteVehicle } from '../services/vehicleService';
import { createPet, updatePet, deletePet } from '../services/petService';
import { colors, layout, radius, spacing, typography } from '../theme';
import { PET_SIZES, PET_SPECIES, type Pet, type PetInput, type Vehicle, type VehicleInput } from '../types/vehiclePet';

type OpenForm = { kind: 'vehicle' } | { kind: 'pet'; pet: Pet | null };
type Removal = { kind: 'vehicle'; item: Vehicle } | { kind: 'pet'; item: Pet };

export function VehiclesPetsScreen(): React.JSX.Element {
  const { user } = useAuth();
  const vehicles = useVehicles();
  const pets = usePets();
  const [form, setForm] = useState<OpenForm | null>(null);
  const [toRemove, setToRemove] = useState<Removal | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const saving = useRef(false);
  const isResident = user?.role === 'MORADOR';
  const isLoading = vehicles.isLoading || pets.isLoading;

  function refresh(): void {
    if (saving.current) return;
    vehicles.reload();
    pets.reload();
  }

  async function mutate(action: () => Promise<unknown>, message: string, reload: () => void): Promise<string | null> {
    if (saving.current) return 'Aguarde a operação em andamento.';
    if (!isResident) return 'Esta ação está disponível para contas de morador.';
    saving.current = true;
    setIsSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      await action();
      setNotice(message);
      reload();
      return null;
    } catch (error) {
      return toApiFailure(error, 'Não foi possível concluir a operação. Tente novamente.').message;
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  async function saveVehicle(input: VehicleInput): Promise<string | null> {
    const error = await mutate(() => createVehicle(input), 'Veículo cadastrado.', vehicles.reload);
    if (!error) setForm(null);
    return error;
  }

  async function savePet(input: PetInput): Promise<string | null> {
    const pet = form?.kind === 'pet' ? form.pet : null;
    const error = await mutate(
      () => pet ? updatePet(pet.id, input) : createPet(input),
      pet ? 'Pet atualizado.' : 'Pet cadastrado.', pets.reload,
    );
    if (!error) setForm(null);
    return error;
  }

  async function confirmRemoval(): Promise<void> {
    const target = toRemove;
    setToRemove(null);
    if (!target || saving.current) return;
    const error = target.kind === 'vehicle'
      ? await mutate(() => deleteVehicle(target.item.id), 'Veículo removido.', vehicles.reload)
      : await mutate(() => deletePet(target.item.id), 'Pet removido.', pets.reload);
    setActionError(error);
    if (!error && target.kind === 'pet' && form?.kind === 'pet' && form.pet?.id === target.item.id) setForm(null);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={colors.brand} colors={[colors.brand]} />}>
          <SectionHeader title="Meus veículos e pets" caption="Gerencie os veículos da sua unidade e os seus pets." />
          {!isResident ? <StatusBanner tone="warning" title="Área do morador" message="O cadastro de veículos e pets está disponível para contas de morador." /> : null}
          {notice ? <StatusBanner tone="info" title={notice} /> : null}
          {actionError ? <StatusBanner tone="error" title="Não foi possível remover" message={actionError} /> : null}
          {isSaving ? <ActivityIndicator color={colors.brand} accessibilityLabel="Salvando alterações" /> : null}

          <View style={styles.section}>
            <SectionHeader title="Veículos" caption="Os veículos cadastrados são compartilhados pela unidade." />
            {vehicles.loadError ? <StatusBanner tone="error" title="Não foi possível atualizar os veículos" message={vehicles.loadError}
              actionLabel="Tentar de novo" onAction={() => { if (!saving.current) vehicles.reload(); }} /> : null}
            {!vehicles.isLoading && !vehicles.loadError && vehicles.parkingSpots !== null ? (
              <Text style={styles.status}>{vehicles.vehicles.length} de {vehicles.parkingSpots} vagas usadas</Text>
            ) : null}
            {isResident && form?.kind !== 'vehicle' ? <Button label="Adicionar veículo" variant="secondary" disabled={isSaving}
              onPress={() => setForm({ kind: 'vehicle' })} /> : null}
            {form?.kind === 'vehicle' ? <View style={styles.card}>
              <VehicleForm isSaving={isSaving} onSubmit={saveVehicle} onCancel={() => setForm(null)} />
            </View> : null}
            {vehicles.isLoading ? <ActivityIndicator color={colors.brand} accessibilityLabel="Carregando veículos" /> : null}
            {isResident && !vehicles.isLoading && !vehicles.loadError && vehicles.vehicles.length === 0 ? <Text style={styles.text}>Nenhum veículo cadastrado na sua unidade.</Text> : null}
            {vehicles.vehicles.map((vehicle) => (
              <View key={vehicle.id} style={styles.card}>
                <Text style={styles.title}>{vehicle.plate}</Text>
                <Text style={styles.text}>{vehicle.model}</Text>
                {vehicle.color ? <Text style={styles.text}>Cor: {vehicle.color}</Text> : null}
                {isResident ? <Button label="Remover veículo" variant="secondary" disabled={isSaving}
                  accessibilityLabel={`Remover veículo ${vehicle.plate}`} onPress={() => setToRemove({ kind: 'vehicle', item: vehicle })} /> : null}
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <SectionHeader title="Pets" caption="Cadastre e mantenha os dados dos seus pets atualizados." />
            {pets.loadError ? <StatusBanner tone="error" title="Não foi possível atualizar os pets" message={pets.loadError}
              actionLabel="Tentar de novo" onAction={() => { if (!saving.current) pets.reload(); }} /> : null}
            {isResident && form?.kind !== 'pet' ? <Button label="Adicionar pet" variant="secondary" disabled={isSaving}
              onPress={() => setForm({ kind: 'pet', pet: null })} /> : null}
            {form?.kind === 'pet' ? <View style={styles.card}>
              <PetForm key={form.pet?.id ?? 'new'} pet={form.pet} isSaving={isSaving} onSubmit={savePet} onCancel={() => setForm(null)} />
            </View> : null}
            {pets.isLoading ? <ActivityIndicator color={colors.brand} accessibilityLabel="Carregando pets" /> : null}
            {isResident && !pets.isLoading && !pets.loadError && pets.pets.length === 0 ? <Text style={styles.text}>Você ainda não cadastrou pets.</Text> : null}
            {pets.pets.map((pet) => (
              <View key={pet.id} style={styles.card}>
                <Text style={styles.title}>{pet.name}</Text>
                <Text style={styles.text}>Espécie: {PET_SPECIES.find((item) => item.value === pet.species)?.label ?? pet.species}</Text>
                <Text style={styles.text}>Porte: {PET_SIZES.find((item) => item.value === pet.size)?.label ?? pet.size}</Text>
                {isResident ? <>
                  <Button label="Editar pet" variant="secondary" disabled={isSaving} accessibilityLabel={`Editar pet ${pet.name}`}
                    onPress={() => setForm({ kind: 'pet', pet })} />
                  <Button label="Remover pet" variant="secondary" disabled={isSaving} accessibilityLabel={`Remover pet ${pet.name}`}
                    onPress={() => setToRemove({ kind: 'pet', item: pet })} />
                </> : null}
              </View>
            ))}
          </View>
          <Button label="Atualizar veículos e pets" variant="ghost" onPress={refresh} disabled={isLoading || isSaving} />
        </ScrollView>
      </KeyboardAvoidingView>
      <ConfirmSheet visible={Boolean(toRemove)} title={toRemove?.kind === 'vehicle' ? 'Remover veículo?' : 'Remover pet?'}
        message={toRemove?.kind === 'vehicle'
          ? `${toRemove.item.plate} · ${toRemove.item.model}. O veículo será removido da sua unidade.`
          : toRemove ? `${toRemove.item.name} será removido do seu cadastro de pets.` : undefined}
        confirmLabel="Confirmar remoção" cancelLabel="Manter cadastro"
        onConfirm={() => void confirmRemoval()} onCancel={() => setToRemove(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: layout.screenPadding, gap: spacing.xl },
  section: { gap: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  title: { ...typography.subtitle, color: colors.textPrimary },
  text: { ...typography.body, color: colors.textSecondary },
  status: { ...typography.bodyStrong, color: colors.brand },
});
