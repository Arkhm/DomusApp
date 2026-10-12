import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, elevation, layout, radius, spacing, typography } from '../theme';

export type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface ModuleCardProps {
  label: string;
  icon: IoniconName;
  onPress: () => void;
  /** Marca módulos que ainda não têm tela própria. */
  isComingSoon?: boolean;
}

/**
 * Cartão do grid de acesso rápido da Home. É o único caminho de entrada de
 * cada módulo — nenhum atalho equivalente deve existir no header ou nas abas.
 */
export function ModuleCard({
  label,
  icon,
  onPress,
  isComingSoon = false,
}: ModuleCardProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={isComingSoon ? `${label}. Em breve.` : label}
      accessibilityHint={`Abrir ${label}`}
      style={({ pressed }) => [styles.card, elevation.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.iconBadge}>
        <Ionicons name={icon} size={22} color={colors.brand} />
      </View>

      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>

      {isComingSoon ? <View style={styles.dot} accessibilityElementsHidden /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 104,
    minWidth: layout.minTouchTarget,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  pressed: {
    opacity: 0.75,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.labelSmall,
    color: colors.textPrimary,
  },
  dot: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
});
