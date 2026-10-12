import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, SectionHeader } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { roleLabel, unitLabel } from '../utils/format';
import { colors, elevation, layout, radius, spacing, typography } from '../theme';

interface InfoRowProps {
  label: string;
  value: string;
}

/** A API grava campos opcionais ora como `null`, ora como string vazia. */
function orDash(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function InfoRow({ label, value }: InfoRowProps): React.JSX.Element {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Aba Perfil. Reúne os dados cadastrais e encerra a sessão; o avatar do header
 * da Home é o atalho para a mesma ação, com confirmação.
 */
export function ProfileScreen(): React.JSX.Element {
  const { user, signOut } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionHeader
          overline="Sua conta"
          title={user?.name ?? 'Perfil'}
          caption={roleLabel(user)}
        />

        <View style={[styles.card, elevation.card]}>
          <InfoRow label="E-mail" value={orDash(user?.email, '—')} />
          <View style={styles.divider} />
          <InfoRow label="Telefone" value={orDash(user?.phone, 'Não informado')} />
          <View style={styles.divider} />
          <InfoRow label="Unidade" value={unitLabel(user) ?? 'Não disponível'} />
        </View>

        <Text style={styles.note}>
          Dados cadastrais são mantidos pela administração do condomínio. Para corrigir alguma
          informação, fale com a portaria ou com o síndico.
        </Text>

        <Button
          label="Sair da conta"
          variant="secondary"
          onPress={() => void signOut()}
          accessibilityHint="Encerra a sessão e volta para a tela de login"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: layout.screenPadding,
    gap: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
  },
  row: {
    paddingVertical: spacing.lg,
    gap: spacing.xxs,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  rowValue: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  note: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
