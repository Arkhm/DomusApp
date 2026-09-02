/**
 * Escala de espaçamento em passos de 4px e tokens de forma/elevação.
 * Alvo de layout: 390x844.
 */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

/** Área de toque mínima acessível (WCAG 2.5.5 / HIG). */
export const layout = {
  minTouchTarget: 44,
  screenPadding: spacing.xl,
  contentMaxWidth: 480,
} as const;

/** Sombras sutis — elevação por camada, nunca inline nos componentes. */
export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  card: {
    shadowColor: '#0B1620',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#0B1620',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;
