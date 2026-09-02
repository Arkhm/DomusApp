/**
 * Paleta do DomusApp mobile.
 *
 * Referência visual: condomínio de alto padrão — base grafite/azulada muito
 * escura para o header, superfícies off-white e um dourado sóbrio como único
 * acento. Nenhum componente deve declarar cor literal: tudo sai daqui.
 */
export const colors = {
  // Marca
  brand: '#12212F',
  brandDeep: '#0B1620',
  brandSoft: '#1D3346',

  // Acento (dourado sóbrio)
  accent: '#C8A45C',
  accentSoft: '#F3E9D4',

  // Superfícies
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F4',

  // Texto
  textPrimary: '#12212F',
  textSecondary: '#5B6B7A',
  textMuted: '#8B9AA8',
  textOnBrand: '#FFFFFF',
  textOnBrandMuted: '#A9BBCA',

  // Bordas e divisores
  border: '#E2E7EC',
  borderStrong: '#CBD4DC',

  // Estados
  danger: '#C0392B',
  dangerSoft: '#FBEAE8',
  success: '#1E8E5A',
  successSoft: '#E6F4EE',
  warning: '#B7791F',
  warningSoft: '#FBF0DC',

  // Sobreposição de modais (escurece a tela atrás do conteúdo em foco)
  overlay: 'rgba(11, 22, 32, 0.55)',

  // Sombra (usada com opacidade nos tokens de elevação)
  shadow: '#0B1620',
} as const;

export type ColorToken = keyof typeof colors;
