import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, elevation, layout, radius, spacing, typography } from '../theme';

export type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface ModuleCardProps {
  label: string;
  icon: IoniconName;
  onPress: () => void;
  /** Contador exibido no canto do cartão (ex.: notificações não lidas). */
  badge?: number | null;
}

/**
 * Cartão do grid de acesso rápido da Home. É o único caminho de entrada de
 * cada módulo — nenhum atalho equivalente deve existir no header ou nas abas.
 */
export function ModuleCard({
  label,
  icon,
  onPress,
  badge = null,
}: ModuleCardProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}. ${badge} ${badge === 1 ? 'não lida' : 'não lidas'}.` : label}
      accessibilityHint={`Abrir ${label}`}
      style={({ pressed }) => [styles.card, elevation.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.iconBadge}>
        <Ionicons name={icon} size={22} color={colors.brand} />
      </View>

      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>

      {badge ? (
        <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
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
  badge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    minWidth: 22,
    height: 22,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...typography.micro,
    color: colors.brand,
  },
});
