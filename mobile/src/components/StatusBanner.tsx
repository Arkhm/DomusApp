import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radius, spacing, typography } from '../theme';

export type StatusTone = 'error' | 'warning' | 'info';

interface StatusBannerProps {
  tone: StatusTone;
  title: string;
  message?: string;
  /** Ação de recuperação (ex.: "Tentar de novo"). Opcional. */
  actionLabel?: string;
  onAction?: () => void;
}

const toneConfig: Record<
  StatusTone,
  { background: string; border: string; foreground: string; icon: React.ComponentProps<typeof Ionicons>['name'] }
> = {
  error: {
    background: colors.dangerSoft,
    border: colors.danger,
    foreground: colors.danger,
    icon: 'alert-circle-outline',
  },
  warning: {
    background: colors.warningSoft,
    border: colors.warning,
    foreground: colors.warning,
    icon: 'warning-outline',
  },
  info: {
    background: colors.surfaceMuted,
    border: colors.borderStrong,
    foreground: colors.textSecondary,
    icon: 'information-circle-outline',
  },
};

/** Estado de erro/aviso inline — usado quando a API não responde. */
export function StatusBanner({
  tone,
  title,
  message,
  actionLabel,
  onAction,
}: StatusBannerProps): React.JSX.Element {
  const config = toneConfig[tone];

  return (
    <View
      style={[styles.wrapper, { backgroundColor: config.background, borderColor: config.border }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={config.icon} size={20} color={config.foreground} />

      <View style={styles.texts}>
        <Text style={[styles.title, { color: config.foreground }]}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}

        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            style={styles.action}
          >
            <Text style={[styles.actionLabel, { color: config.foreground }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  texts: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.bodyStrong,
  },
  message: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  action: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
  },
  actionLabel: {
    ...typography.label,
    textDecorationLine: 'underline',
  },
});
