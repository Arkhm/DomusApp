/**
 * Chave de idempotência da API de cobranças: de 16 a 128 caracteres entre
 * letras, números, hífen e sublinhado.
 *
 * Usa `getRandomValues` e não `crypto.randomUUID` porque o painel pode ser
 * aberto por HTTP fora do localhost, contexto em que `randomUUID` não existe.
 */
export function newIdempotencyKey(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return 'web-' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Devolve sempre a mesma chave enquanto os dados enviados forem os mesmos.
 * Reenviar a mesma emissão (clique duplo, resposta perdida) não duplica a
 * cobrança: a API reconhece a chave e devolve o que já criou. Mudar qualquer
 * dado gera outra chave, porque a API recusa (409) a mesma chave com dados
 * diferentes.
 */
export function createKeyKeeper() {
    let current: { fingerprint: string; key: string } | null = null;
    return (fingerprint: string): string => {
        if (!current || current.fingerprint !== fingerprint) {
            current = { fingerprint, key: newIdempotencyKey() };
        }
        return current.key;
    };
}
