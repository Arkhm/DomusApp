import { describe, expect, it } from 'vitest';
import { issuanceLabel, issuanceTone, statusTone } from './invoiceDisplay';

describe('statusTone', () => {
    it('destaca paga, pendente, vencida e estornos', () => {
        expect(statusTone('PAID')).toBe('ok');
        expect(statusTone('PENDING')).toBe('warn');
        expect(statusTone('OVERDUE')).toBe('err');
        expect(statusTone('REFUNDED')).toBe('purple');
        expect(statusTone('CANCELLED')).toBe('neutral');
    });
});

describe('issuanceTone', () => {
    it('Pix ativo é positivo, em andamento é atenção, revisão é erro', () => {
        expect(issuanceTone('ACTIVE')).toBe('ok');
        expect(issuanceTone('ISSUING')).toBe('warn');
        expect(issuanceTone('REVIEW')).toBe('err');
        expect(issuanceTone('NOT_ISSUED')).toBe('neutral');
    });
});

describe('issuanceLabel', () => {
    it('traduz os estados de emissão', () => {
        expect(issuanceLabel({ issuanceStatus: 'ACTIVE' })).toBe('Pix ativo');
        expect(issuanceLabel({ issuanceStatus: 'NOT_ISSUED' })).toBe('Sem Pix');
    });

    it('mostra a situação do pagamento quando o provedor já a registrou, e o código quando é desconhecido', () => {
        expect(issuanceLabel({ issuanceStatus: 'PAID' })).toBe('Paga');
        expect(issuanceLabel({ issuanceStatus: 'ALGO' })).toBe('ALGO');
    });
});
