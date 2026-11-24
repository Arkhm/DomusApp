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

export interface KeyStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

interface Entry { key: string; at: number }

export interface KeyLedger {
    /**
     * Chave a usar neste envio. Se um envio igual ainda não teve resultado conhecido, devolve a mesma chave
     * dele, mesmo que o modal tenha sido fechado e reaberto; senão, cria uma nova e a grava antes de enviar.
     */
    keyFor(fingerprint: string): string;
    /** Dá o envio por encerrado: a próxima emissão com os mesmos dados passa a gerar uma cobrança nova. */
    settle(fingerprint: string): void;
}

export interface KeyLedgerOptions {
    /** Onde gravar. `null` mantém só em memória (aba anônima, armazenamento bloqueado). */
    storage: KeyStorage | null;
    /** Separa quem usa o mesmo navegador: a API já isola as chaves por usuário. */
    namespace: string;
    now?: () => number;
    /** Por quanto tempo uma chave sem resultado conhecido é lembrada. */
    ttlMs?: number;
    maxEntries?: number;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Registro das chaves de idempotência dos envios cujo resultado ainda é incerto.
 *
 * O caso que ele protege: a API cria a cobrança, mas a resposta se perde. Se a chave sumisse junto com o modal,
 * reenviar os mesmos dados usaria uma chave nova e criaria uma segunda cobrança. Guardando a chave por
 * conteúdo (e não só a do último envio), o reenvio, mesmo depois de fechar o modal ou recarregar a página,
 * devolve a cobrança já criada. Alternar entre envios diferentes (A, depois B, depois A) também preserva a de A.
 */
export function createKeyLedger(options: KeyLedgerOptions): KeyLedger {
    const { storage, namespace, now = Date.now, ttlMs = WEEK_MS, maxEntries = 50 } = options;
    const storageKey = `domusapp:idempotency:v1:${namespace}`;
    let memory: Record<string, Entry> = {};

    function read(): Record<string, Entry> {
        if (storage) {
            try {
                const raw = storage.getItem(storageKey);
                if (raw === null) return {};
                const parsed: unknown = JSON.parse(raw);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, Entry>;
            } catch { /* armazenamento indisponível ou corrompido: cai para a memória */ }
        }
        return memory;
    }

    function write(entries: Record<string, Entry>) {
        const current = now();
        const kept = Object.entries(entries)
            .filter(([, entry]) => entry && typeof entry.key === 'string' && current - entry.at <= ttlMs)
            .sort(([, a], [, b]) => b.at - a.at)
            .slice(0, maxEntries);
        memory = Object.fromEntries(kept);
        if (!storage) return;
        try {
            if (kept.length) storage.setItem(storageKey, JSON.stringify(memory));
            else storage.removeItem(storageKey);
        } catch { /* sem espaço ou bloqueado: a memória segue valendo nesta página */ }
    }

    return {
        keyFor(fingerprint) {
            const entries = read();
            const found = entries[fingerprint];
            if (found && now() - found.at <= ttlMs) return found.key;
            const key = newIdempotencyKey();
            write({ ...entries, [fingerprint]: { key, at: now() } });
            return key;
        },
        settle(fingerprint) {
            const entries = { ...read() };
            delete entries[fingerprint];
            write(entries);
        },
    };
}

function browserStorage(): KeyStorage | null {
    try { return globalThis.localStorage ?? null; } catch { return null; }
}

const ledgers = new Map<string, KeyLedger>();

/** Registro do navegador para um usuário; o mesmo objeto serve a todos os modais, para dividirem a memória de reserva. */
export function keyLedgerFor(namespace: string): KeyLedger {
    let ledger = ledgers.get(namespace);
    if (!ledger) {
        ledger = createKeyLedger({ storage: browserStorage(), namespace });
        ledgers.set(namespace, ledger);
    }
    return ledger;
}

/**
 * Depois de um erro, já se sabe que nada foi criado? Respostas 4xx (exceto 408) são recusas definitivas:
 * a chave pode ser descartada. Sem resposta, 5xx ou 408 deixam o resultado incerto e a chave deve ser mantida.
 */
export function outcomeIsKnown(error: unknown): boolean {
    const status = (error as { response?: { status?: unknown } } | null)?.response?.status;
    return typeof status === 'number' && status >= 400 && status < 500 && status !== 408;
}
