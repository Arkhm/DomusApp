import type { TextStyle } from 'react-native';

/**
 * Famílias Inter carregadas por `useAppFonts` (expo-font + @expo-google-fonts).
 * Os nomes batem com as chaves passadas para `useFonts`.
 */
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/**
 * Hierarquia tipográfica. Componentes consomem estes estilos inteiros em vez
 * de declarar fontSize/fontWeight soltos.
 */
export const typography = {
  display: {
    fontFamily: fontFamily.bold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  bodyStrong: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    lineHeight: 22,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  labelSmall: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  micro: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    lineHeight: 14,
  },
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  overline: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;
