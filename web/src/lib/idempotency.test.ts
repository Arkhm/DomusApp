import { describe, expect, it } from 'vitest';
import { createKeyLedger, newIdempotencyKey, outcomeIsKnown, type KeyStorage } from './idempotency';

const KEY_RE = /^[A-Za-z0-9_-]{16,128}$/;

function fakeStorage(): KeyStorage & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return {
        data,
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => { data.set(key, value); },
        removeItem: (key) => { data.delete(key); },
    };
}

function clock(start = 1_000_000) {
    let current = start;
    const now = () => current;
    return { now, advance: (ms: number) => { current += ms; } };
}

describe('newIdempotencyKey', () => {
    it('gera chaves no formato que a API aceita e diferentes entre si', () => {
        const keys = Array.from({ length: 50 }, newIdempotencyKey);
        expect(keys.every((key) => KEY_RE.test(key))).toBe(true);
        expect(new Set(keys).size).toBe(50);
    });
});

describe('createKeyLedger', () => {
    it('devolve a mesma chave para o mesmo envio e chaves diferentes para envios diferentes', () => {
        const ledger = createKeyLedger({ storage: fakeStorage(), namespace: 'u1' });
        expect(ledger.keyFor('A')).toBe(ledger.keyFor('A'));
        expect(ledger.keyFor('A')).not.toBe(ledger.keyFor('B'));
    });

    it('mantém a chave ao fechar e reabrir o modal (caso do review: resposta perdida e reenvio)', () => {
        const storage = fakeStorage();
        const firstModal = createKeyLedger({ storage, namespace: 'u1' });
        const keySentFirst = firstModal.keyFor('mesmos-dados'); // a API criou a cobrança, mas a resposta se perdeu
        const reopenedModal = createKeyLedger({ storage, namespace: 'u1' }); // outro objeto, como num novo modal ou página
        expect(reopenedModal.keyFor('mesmos-dados')).toBe(keySentFirst);
    });

    it('a sequência A → B → A mantém a chave de A (caso do review)', () => {
        const ledger = createKeyLedger({ storage: fakeStorage(), namespace: 'u1' });
        const keyA = ledger.keyFor('A');
        ledger.keyFor('B');
        expect(ledger.keyFor('A')).toBe(keyA);
    });

    it('depois de encerrado (settle), o mesmo conteúdo ganha uma chave nova e as outras permanecem', () => {
        const ledger = createKeyLedger({ storage: fakeStorage(), namespace: 'u1' });
        const keyA = ledger.keyFor('A');
        const keyB = ledger.keyFor('B');
        ledger.settle('A');
        expect(ledger.keyFor('A')).not.toBe(keyA);
        expect(ledger.keyFor('B')).toBe(keyB);
    });

    it('esquece chaves depois do prazo, mas lembra até lá', () => {
        const { now, advance } = clock();
        const ledger = createKeyLedger({ storage: fakeStorage(), namespace: 'u1', now, ttlMs: 1000 });
        const key = ledger.keyFor('A');
        advance(1000);
        expect(ledger.keyFor('A')).toBe(key);
        advance(1);
        expect(ledger.keyFor('A')).not.toBe(key);
    });

    it('limita o número de entradas, descartando as mais antigas', () => {
        const { now, advance } = clock();
        const storage = fakeStorage();
        const ledger = createKeyLedger({ storage, namespace: 'u1', now, maxEntries: 3 });
        const first = ledger.keyFor('1');
        for (const fingerprint of ['2', '3', '4']) { advance(10); ledger.keyFor(fingerprint); }
        const stored = JSON.parse(storage.data.get('domusapp:idempotency:v1:u1')!) as Record<string, unknown>;
        expect(Object.keys(stored).sort()).toEqual(['2', '3', '4']);
        expect(ledger.keyFor('1')).not.toBe(first);
    });

    it('isola os usuários que dividem o navegador', () => {
        const storage = fakeStorage();
        const ana = createKeyLedger({ storage, namespace: 'ana' });
        const bia = createKeyLedger({ storage, namespace: 'bia' });
        expect(ana.keyFor('A')).not.toBe(bia.keyFor('A'));
        expect(storage.data.size).toBe(2);
    });

    it('sem armazenamento disponível, segue funcionando em memória', () => {
        const ledger = createKeyLedger({ storage: null, namespace: 'u1' });
        expect(ledger.keyFor('A')).toBe(ledger.keyFor('A'));
    });

    it('se o armazenamento falhar ao ler ou gravar, cai para a memória sem lançar erro', () => {
        const broken: KeyStorage = {
            getItem: () => { throw new Error('bloqueado'); },
            setItem: () => { throw new Error('cheio'); },
            removeItem: () => { throw new Error('bloqueado'); },
        };
        const ledger = createKeyLedger({ storage: broken, namespace: 'u1' });
        const key = ledger.keyFor('A');
        expect(ledger.keyFor('A')).toBe(key);
        expect(() => ledger.settle('A')).not.toThrow();
    });

    it('trata conteúdo corrompido no armazenamento como vazio', () => {
        const storage = fakeStorage();
        storage.data.set('domusapp:idempotency:v1:u1', '{isto não é json');
        const ledger = createKeyLedger({ storage, namespace: 'u1' });
        expect(KEY_RE.test(ledger.keyFor('A'))).toBe(true);
        storage.data.set('domusapp:idempotency:v1:u1', '[1,2]');
        expect(KEY_RE.test(ledger.keyFor('B'))).toBe(true);
    });
});

describe('outcomeIsKnown', () => {
    it('recusas 4xx definitivas permitem descartar a chave', () => {
        for (const status of [400, 403, 409, 422, 429]) expect(outcomeIsKnown({ response: { status } }), String(status)).toBe(true);
    });

    it('sem resposta, 408 e 5xx deixam o resultado incerto: a chave deve ser mantida', () => {
        for (const status of [408, 500, 502, 503]) expect(outcomeIsKnown({ response: { status } }), String(status)).toBe(false);
        expect(outcomeIsKnown(new Error('Network Error'))).toBe(false);
        expect(outcomeIsKnown(null)).toBe(false);
        expect(outcomeIsKnown({ response: {} })).toBe(false);
    });
});
