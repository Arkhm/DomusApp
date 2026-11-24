const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
/** Um QR Code do Mercado Pago tem poucos KB; acima disto o dado é suspeito e não vira imagem. */
const MAX_BASE64_LENGTH = 200_000;

/**
 * Endereço da imagem do QR Code, ou `null` quando o dado não é base64 puro.
 * O texto vem do provedor; só base64 vira `data:image/png`, nada mais é interpolado no atributo.
 */
export function pixImageSource(base64: string | null | undefined): string | null {
    const clean = (base64 ?? '').replace(/\s/g, '');
    if (!clean || clean.length > MAX_BASE64_LENGTH || !BASE64.test(clean)) return null;
    return `data:image/png;base64,${clean}`;
}

/**
 * Copia o texto para a área de transferência. A API moderna só existe em contexto seguro (HTTPS ou localhost);
 * fora dele usa a cópia por seleção. Devolve se conseguiu.
 */
export async function copyText(text: string): Promise<boolean> {
    try {
        if (globalThis.navigator?.clipboard?.writeText) {
            await globalThis.navigator.clipboard.writeText(text);
            return true;
        }
    } catch { /* cai para o método antigo */ }
    try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(area);
        return copied;
    } catch { return false; }
}

/** Endereço vindo do provedor só vira link quando é HTTPS; qualquer outro esquema (javascript:, data:, http:) é descartado. */
export function safeHttpsUrl(value: string | null | undefined): string | null {
    if (!value) return null;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' ? url.toString() : null;
    } catch { return null; }
}
