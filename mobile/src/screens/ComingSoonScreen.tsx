import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, elevation, layout, radius, spacing, typography } from '../theme';
import type { RootStackScreenProps } from '../types';

/**
 * Placeholder de módulo. Recebe o rótulo do módulo e a nota do que ainda falta
 * (ver `src/config/modules.ts`) em vez de um texto genérico.
 */
export function ComingSoonScreen({
  route,
}: RootStackScreenProps<'EmBreve'>): React.JSX.Element {
  const { title, description } = route.params;

  return (
    <View style={styles.screen}>
      <View style={[styles.card, elevation.card]}>
        <View style={styles.iconBadge}>
          <Ionicons name="construct-outline" size={28} color={colors.accent} />
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Em breve</Text>

        <Text style={styles.description}>
          {description ?? 'Este módulo ainda não faz parte desta versão do aplicativo.'}
        </Text>
      </View>
    </View>
  );
}

/** Versão sem parâmetros, usada pelas abas que ainda não têm implementação. */
export function TabPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}): React.JSX.Element {
  return (
    <View style={styles.screen}>
      <View style={[styles.card, elevation.card]}>
        <View style={styles.iconBadge}>
          <Ionicons name="construct-outline" size={28} color={colors.accent} />
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Em breve</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: layout.screenPadding,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.overline,
    color: colors.accent,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
