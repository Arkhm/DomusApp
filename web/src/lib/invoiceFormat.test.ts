import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDateTimeBR, formatDueDateBR, formatMoneyBR, formatReferenceMonthBR, monthEndShifted, monthStartShifted, todayBR } from './invoiceFormat';

// Em pt-BR o Intl separa "R$" do número com espaço inseparável.
const brl = (text: string) => text.replace(/\s/g, ' ');

describe('formatMoneyBR', () => {
    it('formata valores decimais vindos da API', () => {
        expect(brl(formatMoneyBR('350.00'))).toBe('R$ 350,00');
        expect(brl(formatMoneyBR('1234.5'))).toBe('R$ 1.234,50');
        expect(brl(formatMoneyBR('0.05'))).toBe('R$ 0,05');
    });

    it('não perde centavos em valores que o ponto flutuante não representa', () => {
        expect(brl(formatMoneyBR('99999999.99'))).toBe('R$ 99.999.999,99');
        expect(brl(formatMoneyBR('12345678901234.57'))).toBe('R$ 12.345.678.901.234,57');
    });

    it('aceita números e devolve o texto original quando o valor é inválido', () => {
        expect(brl(formatMoneyBR(80))).toBe('R$ 80,00');
        expect(formatMoneyBR('abc')).toBe('abc');
        expect(formatMoneyBR('-5.00')).toBe('-5.00');
    });
});

describe('formatDueDateBR', () => {
    afterEach(() => { vi.unstubAllEnvs(); });

    it('mostra o dia de calendário gravado em UTC, em qualquer fuso', () => {
        for (const tz of ['America/Sao_Paulo', 'America/Los_Angeles', 'Pacific/Auckland', 'UTC']) {
            vi.stubEnv('TZ', tz);
            expect(formatDueDateBR('2026-11-14T00:00:00.000Z'), tz).toBe('14/11/2026');
        }
    });
});

describe('todayBR', () => {
    afterEach(() => { vi.useRealTimers(); });

    it('usa o dia de Brasília, não o de UTC', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-15T01:30:00Z')); // 22:30 de 14/11 em Brasília
        expect(todayBR()).toBe('2026-11-14');
        vi.setSystemTime(new Date('2026-11-15T03:00:00Z')); // 00:00 de 15/11 em Brasília
        expect(todayBR()).toBe('2026-11-15');
    });
});

describe('monthStartShifted / monthEndShifted', () => {
    it('desloca o primeiro dia do mês, atravessando o ano', () => {
        expect(monthStartShifted('2026-11-14', -11)).toBe('2025-12-01');
        expect(monthStartShifted('2026-01-31', -1)).toBe('2025-12-01');
        expect(monthStartShifted('2026-11-14', 0)).toBe('2026-11-01');
    });

    it('devolve o último dia do mês, inclusive em fevereiro bissexto', () => {
        expect(monthEndShifted('2026-11-14', 6)).toBe('2027-05-31');
        expect(monthEndShifted('2024-01-31', 1)).toBe('2024-02-29');
        expect(monthEndShifted('2025-01-31', 1)).toBe('2025-02-28');
        expect(monthEndShifted('2026-12-10', 0)).toBe('2026-12-31');
    });
});

describe('formatDateTimeBR', () => {
    it('mostra data e hora no horário de Brasília', () => {
        expect(formatDateTimeBR('2026-11-14T15:30:00.000Z')).toBe('14/11/2026 12:30');
        expect(formatDateTimeBR('2026-11-15T02:05:00.000Z')).toBe('14/11/2026 23:05');
    });

    it('devolve o texto original quando a data é inválida', () => {
        expect(formatDateTimeBR('não é data')).toBe('não é data');
    });
});

describe('formatReferenceMonthBR', () => {
    it('mostra mês/ano do mês de referência', () => {
        expect(formatReferenceMonthBR('2026-12-01T00:00:00.000Z')).toBe('12/2026');
        expect(formatReferenceMonthBR('2026-01-01')).toBe('01/2026');
    });

    it('usa o traço quando não há mês de referência', () => {
        expect(formatReferenceMonthBR(null)).toBe('—');
    });
});
