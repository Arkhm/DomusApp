import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

/**
 * Carrega a família Inter usada por `src/theme/typography.ts`.
 * Devolve `true` quando as fontes estão prontas (ou quando falharam — nesse
 * caso o RN cai na fonte do sistema em vez de travar o app na splash).
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  return loaded || error !== null;
}
