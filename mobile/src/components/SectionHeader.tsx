import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

interface SectionHeaderProps {
  title: string;
  /** Linha de apoio opcional, abaixo do título. */
  caption?: string;
  /** Rótulo curto acima do título (ex.: "Resumo"). */
  overline?: string;
}

/**
 * Cabeçalho de seção. De propósito não aceita botão de ação: cada função tem
 * um único ponto de acesso (o cartão do módulo), sem atalho duplicado aqui.
 */
export function SectionHeader({
  title,
  caption,
  overline,
}: SectionHeaderProps): React.JSX.Element {
  return (
    <View style={styles.wrapper} accessibilityRole="header">
      {overline ? <Text style={styles.overline}>{overline}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  overline: {
    ...typography.overline,
    color: colors.textMuted,
  },
  title: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
