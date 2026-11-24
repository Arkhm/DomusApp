import { describe, expect, it } from 'vitest';
import { describeBatchResult, describeSingleResult, tallyIssuance } from './emissionResult';

const withStates = (...states: string[]) => states.map((issuanceStatus) => ({ issuanceStatus }));

describe('tallyIssuance', () => {
    it('separa Pix ativos, em andamento, em revisão e demais situações', () => {
        expect(tallyIssuance(withStates('ACTIVE', 'ACTIVE', 'QUEUED', 'RETRY', 'ISSUING', 'REVIEW', 'NOT_ISSUED', 'LEGACY')))
            .toEqual({ total: 8, active: 2, inFlight: 3, review: 1, other: 2 });
    });
});

describe('describeBatchResult', () => {
    it('só diz que os Pix estão disponíveis quando todos estão ativos', () => {
        const result = describeBatchResult(tallyIssuance(withStates('ACTIVE', 'ACTIVE')));
        expect(result.text).toBe('2 cobranças criadas. Os Pix já estão disponíveis.');
        expect(result.needsAttention).toBe(false);
    });

    it('caso do review: nada em andamento, mas itens em revisão, não pode dizer que estão disponíveis', () => {
        const result = describeBatchResult(tallyIssuance(withStates('ACTIVE', 'REVIEW', 'REVIEW')));
        expect(result.text).not.toMatch(/já estão disponíveis/);
        expect(result.text).toMatch(/Pix disponíveis: 1\./);
        expect(result.text).toMatch(/Em revisão: 2\./);
        expect(result.needsAttention).toBe(true);
    });

    it('itens com outra situação também chamam a atenção', () => {
        const result = describeBatchResult(tallyIssuance(withStates('ACTIVE', 'NOT_ISSUED')));
        expect(result.text).toMatch(/Com outra situação: 1\./);
        expect(result.needsAttention).toBe(true);
    });

    it('itens em andamento avisam que a lista se atualiza sozinha, sem alarme', () => {
        const result = describeBatchResult(tallyIssuance(withStates('QUEUED', 'QUEUED', 'ACTIVE')));
        expect(result.text).toMatch(/Em geração em segundo plano: 2; a lista se atualiza sozinha\./);
        expect(result.needsAttention).toBe(false);
    });

    it('concorda no singular e trata lote vazio', () => {
        expect(describeBatchResult(tallyIssuance(withStates('ACTIVE'))).text).toBe('1 cobrança criada. Os Pix já estão disponíveis.');
        expect(describeBatchResult(tallyIssuance([])).text).toBe('Nenhuma cobrança foi criada.');
    });
});

describe('describeSingleResult', () => {
    it('Pix ativo: sucesso', () => {
        expect(describeSingleResult('ACTIVE')).toMatchObject({ tone: 'ok', needsAttention: false });
    });

    it('em andamento: aviso sem alarme', () => {
        for (const state of ['QUEUED', 'RETRY', 'ISSUING']) {
            expect(describeSingleResult(state), state).toMatchObject({ tone: 'warn', needsAttention: false });
        }
    });

    it('em revisão: erro que chama a atenção', () => {
        expect(describeSingleResult('REVIEW')).toMatchObject({ tone: 'err', needsAttention: true });
    });

    it('qualquer outra situação é informada pelo nome e chama a atenção', () => {
        const result = describeSingleResult('NOT_ISSUED');
        expect(result.text).toMatch(/“Sem Pix”/);
        expect(result.needsAttention).toBe(true);
        expect(describeSingleResult('DESCONHECIDO').text).toMatch(/“DESCONHECIDO”/);
    });
});
