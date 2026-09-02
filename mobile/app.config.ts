import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * baseURL da API REST do DomusApp.
 *
 * Sobrescreva com a variável de ambiente `DOMUS_API_URL` ao iniciar o Expo.
 * Valores típicos:
 *   - Emulador Android ............ http://10.0.2.2:3333
 *   - Simulador iOS / web ......... http://localhost:3333
 *   - Celular físico (Expo Go) .... http://<IP-da-sua-maquina>:3333
 */
const DEFAULT_API_URL = 'http://localhost:3333';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'DomusApp',
  slug: 'domusapp',
  scheme: 'domusapp',
  extra: {
    ...config.extra,
    apiUrl: process.env.DOMUS_API_URL ?? DEFAULT_API_URL,
  },
});
