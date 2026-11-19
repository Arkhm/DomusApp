import { describe, expect, it } from 'vitest';
import { SUMMARY_LIMIT_MESSAGE, maxSummaryEnd, summaryPeriod, summaryPeriodIssue } from './invoicePeriod';

const TODAY = '2026-11-14';
const none = { startDate: '', endDate: '' };

describe('summaryPeriod', () => {
    it('sem datas, cobre os últimos 12 meses e os próximos 6', () => {
        expect(summaryPeriod(none, TODAY)).toEqual({ startDate: '2025-12-01', endDate: '2027-05-31' });
    });

    it('com as duas datas, usa exatamente o que foi pedido', () => {
        expect(summaryPeriod({ startDate: '2026-01-01', endDate: '2026-03-31' }, TODAY))
            .toEqual({ startDate: '2026-01-01', endDate: '2026-03-31' });
    });

    it('só com o fim, nunca inverte o período (caso do review: fim 2025-01-31)', () => {
        const period = summaryPeriod({ startDate: '', endDate: '2025-01-31' }, TODAY);
        expect(period).toEqual({ startDate: '2024-02-01', endDate: '2025-01-31' });
        expect(period.startDate <= period.endDate).toBe(true);
    });

    it('só com o início recente, vai até o fim padrão', () => {
        expect(summaryPeriod({ startDate: '2026-06-10', endDate: '' }, TODAY))
            .toEqual({ startDate: '2026-06-10', endDate: '2027-05-31' });
    });

    it('só com o início no futuro distante, abre uma janela de 12 meses a partir dele', () => {
        expect(summaryPeriod({ startDate: '2028-03-10', endDate: '' }, TODAY))
            .toEqual({ startDate: '2028-03-10', endDate: '2029-02-28' });
    });

    it('só com o início antigo, limita o fim a 24 meses para a API não recusar', () => {
        const period = summaryPeriod({ startDate: '2023-01-01', endDate: '' }, TODAY);
        expect(period).toEqual({ startDate: '2023-01-01', endDate: '2024-12-31' });
        expect(summaryPeriodIssue(period)).toBe('');
    });
});

describe('maxSummaryEnd', () => {
    it('é o dia anterior ao segundo aniversário do início', () => {
        expect(maxSummaryEnd('2025-01-01')).toBe('2026-12-31');
        expect(maxSummaryEnd('2025-03-15')).toBe('2027-03-14');
    });

    it('trata 29 de fevereiro como a API: o aniversário cai em 28/02', () => {
        expect(maxSummaryEnd('2024-02-29')).toBe('2026-02-27');
    });
});

describe('summaryPeriodIssue', () => {
    it('aceita até 24 meses', () => {
        expect(summaryPeriodIssue({ startDate: '2025-01-01', endDate: '2026-12-31' })).toBe('');
    });

    it('avisa quando passa de 24 meses', () => {
        expect(summaryPeriodIssue({ startDate: '2025-01-01', endDate: '2027-01-01' })).toBe(SUMMARY_LIMIT_MESSAGE);
    });

    it('deixa o intervalo invertido para o aviso próprio dos filtros', () => {
        expect(summaryPeriodIssue({ startDate: '2026-05-01', endDate: '2026-01-01' })).toBe('');
    });
});
