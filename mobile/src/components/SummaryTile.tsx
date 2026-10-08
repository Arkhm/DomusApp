import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';

interface SummaryTileProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  /** Valor em destaque (ex.: "3", "12 de set"). */
  value: string;
  label: string;
  /** Linha secundária opcional (ex.: nome do evento). */
  detail?: string;
}

/** Bloco informativo do resumo do topo da Home. Não é clicável de propósito. */
export function SummaryTile({ icon, value, label, detail }: SummaryTileProps): React.JSX.Element {
  return (
    <View
      style={styles.tile}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={detail ? `${label}: ${value}. ${detail}` : `${label}: ${value}`}
    >
      <View style={styles.header}>
        <Ionicons name={icon} size={16} color={colors.accent} />
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>

      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>

      {detail ? (
        <Text style={styles.detail} numberOfLines={2}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 96,
    borderRadius: radius.lg,
    backgroundColor: colors.brandSoft,
    padding: spacing.lg,
    gap: spacing.xs,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.textOnBrandMuted,
    flexShrink: 1,
  },
  value: {
    ...typography.title,
    color: colors.textOnBrand,
  },
  detail: {
    ...typography.caption,
    color: colors.textOnBrandMuted,
  },
});
