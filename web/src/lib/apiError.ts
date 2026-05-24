/**
 * Extrai a mensagem de erro padrão dos responses da API (`{ error: string }`).
 * Substitui o pattern `catch (error: any) { error.response?.data?.error }` que
 * espalhava `any` por todos os componentes — agora os catches são `unknown` e
 * delegam o parse aqui.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object' && 'response' in error) {
        const response = (error as { response?: { data?: { error?: string } } }).response;
        if (response?.data?.error && typeof response.data.error === 'string') {
            return response.data.error;
        }
    }
    return fallback;
}
