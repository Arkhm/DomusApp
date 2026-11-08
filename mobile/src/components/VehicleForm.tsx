import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { Input } from './Input';
import { StatusBanner } from './StatusBanner';
import { validateVehicleInput } from '../services/vehicleService';
import { colors, spacing, typography } from '../theme';
import type { VehicleInput } from '../types/vehiclePet';

interface VehicleFormProps {
  isSaving: boolean;
  onSubmit: (input: VehicleInput) => Promise<string | null>;
  onCancel: () => void;
}

export function VehicleForm({ isSaving, onSubmit, onCancel }: VehicleFormProps): React.JSX.Element {
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    if (isSaving) return;
    const input = { plate, model, color };
    const validation = validateVehicleInput(input);
    setError(validation);
    if (!validation) setError(await onSubmit(input));
  }

  return (
    <View style={styles.form}>
      <Text style={styles.title}>Adicionar veículo</Text>
      <Input label="Placa" value={plate} onChangeText={setPlate} placeholder="ABC1234 ou ABC1D23"
        autoCapitalize="characters" editable={!isSaving} />
      <Input label="Modelo" value={model} onChangeText={setModel} maxLength={191}
        autoCapitalize="words" editable={!isSaving} />
      <Input label="Cor (opcional)" value={color} onChangeText={setColor} maxLength={191}
        autoCapitalize="words" editable={!isSaving} />
      {error ? <StatusBanner tone="error" title="Confira o veículo" message={error} /> : null}
      <Button label="Salvar veículo" onPress={() => void submit()} isLoading={isSaving} />
      <Button label="Cancelar cadastro" variant="ghost" onPress={onCancel} disabled={isSaving} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  title: { ...typography.subtitle, color: colors.textPrimary },
});
