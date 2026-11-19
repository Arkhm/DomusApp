import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, RANGE_ERROR_MESSAGE, buildInvoiceQuery, filterRangeError, type InvoiceFilterState } from './invoiceQuery';

const NOW = new Date('2026-11-14T15:00:00.000Z');
const filters = (patch: Partial<InvoiceFilterState> = {}): InvoiceFilterState => ({ ...EMPTY_FILTERS, ...patch });
const paramsOf = (state: InvoiceFilterState) => {
    const query = buildInvoiceQuery(state, 2, 20, NOW);
    if (query.kind !== 'query') throw new Error('esperava uma consulta');
    return query.params;
};

describe('filterRangeError', () => {
    it('só acusa intervalo invertido quando as duas datas estão preenchidas', () => {
        expect(filterRangeError(filters({ startDate: '2026-05-01', endDate: '2026-01-01' }))).toBe(RANGE_ERROR_MESSAGE);
        expect(filterRangeError(filters({ startDate: '2026-05-01', endDate: '2026-05-01' }))).toBe('');
        expect(filterRangeError(filters({ startDate: '2026-05-01' }))).toBe('');
        expect(filterRangeError(filters({ endDate: '2025-01-31' }))).toBe('');
    });
});

describe('buildInvoiceQuery', () => {
    it('sem filtros, envia só a paginação', () => {
        expect(paramsOf(filters())).toEqual({ page: 2, limit: 20 });
    });

    it('o vencimento final vale o dia inteiro (caso do review: cobrança às 12h do último dia)', () => {
        const params = paramsOf(filters({ endDate: '2026-11-14' }));
        expect(params.endDate).toBe('2026-11-14T23:59:59.999Z');
        // a cobrança das 12h do dia 14 fica dentro do intervalo; a da meia-noite do dia 15 fica fora
        expect(new Date('2026-11-14T12:00:00.000Z') <= new Date(params.endDate!)).toBe(true);
        expect(new Date('2026-11-15T00:00:00.000Z') <= new Date(params.endDate!)).toBe(false);
    });

    it('o vencimento inicial segue como a data escolhida (meia-noite UTC, inclusiva)', () => {
        expect(paramsOf(filters({ startDate: '2026-11-01' })).startDate).toBe('2026-11-01');
    });

    it('repassa status, tipo e unidade e descarta campos vazios', () => {
        const params = paramsOf(filters({ status: 'PAID', type: 'FINE', unitId: 'abc' }));
        expect(params).toMatchObject({ status: 'PAID', type: 'FINE', unitId: 'abc' });
        expect(paramsOf(filters({ status: 'PAID' })).type).toBeUndefined();
    });

    describe('status "Pendente" (a vencer)', () => {
        it('exclui as já vencidas: só entram vencimentos de agora em diante', () => {
            expect(paramsOf(filters({ status: 'PENDING' })).startDate).toBe(NOW.toISOString());
        });

        it('um início passado é elevado para agora; um início futuro é respeitado', () => {
            expect(paramsOf(filters({ status: 'PENDING', startDate: '2026-01-01' })).startDate).toBe(NOW.toISOString());
            expect(paramsOf(filters({ status: 'PENDING', startDate: '2026-12-01' })).startDate).toBe('2026-12-01');
        });

        it('com vencimento final no passado não há resultado possível: não consulta a API', () => {
            expect(buildInvoiceQuery(filters({ status: 'PENDING', endDate: '2026-10-31' }), 1, 20, NOW)).toEqual({ kind: 'empty' });
        });

        it('com vencimento final hoje ainda consulta (o dia de hoje não terminou)', () => {
            expect(buildInvoiceQuery(filters({ status: 'PENDING', endDate: '2026-11-14' }), 1, 20, NOW).kind).toBe('query');
        });

        it('os outros status não mudam o início', () => {
            expect(paramsOf(filters({ status: 'OVERDUE' })).startDate).toBeUndefined();
            expect(paramsOf(filters({ status: 'PAID', startDate: '2026-01-01' })).startDate).toBe('2026-01-01');
        });
    });
});
