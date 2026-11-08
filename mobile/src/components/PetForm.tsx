import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { Input } from './Input';
import { StatusBanner } from './StatusBanner';
import { validatePetInput } from '../services/petService';
import { colors, layout, radius, spacing, typography } from '../theme';
import { PET_SIZES, PET_SPECIES, type Pet, type PetInput, type PetSize, type PetSpecies } from '../types/vehiclePet';

interface PetFormProps {
  pet: Pet | null;
  isSaving: boolean;
  onSubmit: (input: PetInput) => Promise<string | null>;
  onCancel: () => void;
}

export function PetForm({ pet, isSaving, onSubmit, onCancel }: PetFormProps): React.JSX.Element {
  const [name, setName] = useState(pet?.name ?? '');
  const [species, setSpecies] = useState<PetSpecies | ''>(pet?.species ?? '');
  const [size, setSize] = useState<PetSize | ''>(pet?.size ?? '');
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    if (isSaving) return;
    const validation = validatePetInput({ name, species, size });
    setError(validation);
    if (!validation && species && size) setError(await onSubmit({ name, species, size }));
  }

  return (
    <View style={styles.form}>
      <Text style={styles.title}>{pet ? 'Editar pet' : 'Adicionar pet'}</Text>
      <Input label="Nome do pet" value={name} onChangeText={setName} maxLength={191}
        autoCapitalize="words" editable={!isSaving} />
      <Text style={styles.text}>Espécie</Text>
      <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Espécie do pet">
        {PET_SPECIES.map((item) => (
          <Pressable key={item.value} onPress={() => setSpecies(item.value)} disabled={isSaving}
            accessibilityRole="radio" accessibilityLabel={item.label}
            accessibilityState={{ checked: species === item.value, disabled: isSaving }}
            style={[styles.option, species === item.value ? styles.selected : null]}>
            <Text style={styles.text}>{species === item.value ? 'Selecionada: ' : ''}{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.text}>Porte</Text>
      <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Porte do pet">
        {PET_SIZES.map((item) => (
          <Pressable key={item.value} onPress={() => setSize(item.value)} disabled={isSaving}
            accessibilityRole="radio" accessibilityLabel={item.label}
            accessibilityState={{ checked: size === item.value, disabled: isSaving }}
            style={[styles.option, size === item.value ? styles.selected : null]}>
            <Text style={styles.text}>{size === item.value ? 'Selecionado: ' : ''}{item.label}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <StatusBanner tone="error" title="Confira o pet" message={error} /> : null}
      <Button label={pet ? 'Salvar alterações' : 'Salvar pet'} onPress={() => void submit()} isLoading={isSaving} />
      <Button label="Cancelar" variant="ghost" onPress={onCancel} disabled={isSaving} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  title: { ...typography.subtitle, color: colors.textPrimary },
  text: { ...typography.body, color: colors.textSecondary },
  options: { gap: spacing.sm },
  option: { minHeight: layout.minTouchTarget, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  selected: { borderColor: colors.brand, backgroundColor: colors.surfaceMuted },
});
