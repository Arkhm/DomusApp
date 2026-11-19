import { describe, expect, it } from 'vitest';
import { effectiveInvoiceStatus } from './invoice';

const now = new Date('2026-11-14T15:00:00.000Z');

describe('effectiveInvoiceStatus', () => {
    it('trata pendente com vencimento passado como vencida, como a API e o relatório', () => {
        expect(effectiveInvoiceStatus({ status: 'PENDING', dueDate: '2026-11-13T00:00:00.000Z' }, now)).toBe('OVERDUE');
    });

    it('mantém pendente quando o vencimento ainda não chegou', () => {
        expect(effectiveInvoiceStatus({ status: 'PENDING', dueDate: '2026-11-15T00:00:00.000Z' }, now)).toBe('PENDING');
    });

    it('usa a mesma fronteira da API: vencimento igual a agora ainda não é vencida', () => {
        expect(effectiveInvoiceStatus({ status: 'PENDING', dueDate: now.toISOString() }, now)).toBe('PENDING');
    });

    it('não altera os demais status', () => {
        for (const status of ['PAID', 'CANCELLED', 'REFUNDED', 'OVERDUE'] as const) {
            expect(effectiveInvoiceStatus({ status, dueDate: '2020-01-01T00:00:00.000Z' }, now)).toBe(status);
        }
    });
});
