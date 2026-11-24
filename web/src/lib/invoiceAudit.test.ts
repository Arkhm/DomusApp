import { describe, expect, it } from 'vitest';
import { auditActionLabel, auditActor, auditSourceLabel, auditTransition, paymentSourceLabel } from './invoiceAudit';

describe('auditActionLabel / auditSourceLabel', () => {
    it('traduz as ações e origens que a API grava', () => {
        expect(auditActionLabel('MANUAL_PAYMENT')).toBe('Baixa manual: paga');
        expect(auditActionLabel('CANCEL')).toBe('Cobrança cancelada');
        expect(auditActionLabel('RECONCILE')).toBe('Conciliação com o Mercado Pago');
        expect(auditActionLabel('RETRY_REQUESTED')).toBe('Reenvio da emissão solicitado');
        expect(auditSourceLabel('MANUAL')).toBe('Equipe');
        expect(auditSourceLabel('MERCADO_PAGO_TEST')).toBe('Mercado Pago (teste)');
    });

    it('mostra o código original quando a ação é desconhecida, sem esconder o registro', () => {
        expect(auditActionLabel('ALGO_NOVO')).toBe('ALGO_NOVO');
        expect(auditSourceLabel('OUTRO')).toBe('OUTRO');
    });
});

describe('auditTransition', () => {
    it('mostra a mudança de situação com os rótulos da tela', () => {
        expect(auditTransition({ fromStatus: 'PENDING', toStatus: 'PAID' })).toBe('Pendente → Paga');
        expect(auditTransition({ fromStatus: 'OVERDUE', toStatus: 'CANCELLED' })).toBe('Vencida → Cancelada');
    });

    it('fica vazio quando a situação não mudou', () => {
        expect(auditTransition({ fromStatus: 'PENDING', toStatus: 'PENDING' })).toBe('');
    });

    it('não quebra com uma situação desconhecida', () => {
        expect(auditTransition({ fromStatus: 'PENDING', toStatus: 'NOVA' })).toBe('Pendente → NOVA');
    });
});

describe('auditActor', () => {
    const names = { u1: 'Carlos Porteiro' };

    it('usa o nome do usuário quando conhecido', () => {
        expect(auditActor({ actorId: 'u1', source: 'MANUAL' }, names)).toBe('Carlos Porteiro');
    });

    it('registros automáticos aparecem pela origem (Sistema, Mercado Pago)', () => {
        expect(auditActor({ actorId: null, source: 'SYSTEM' }, names)).toBe('Sistema');
        expect(auditActor({ actorId: null, source: 'MERCADO_PAGO' }, names)).toBe('Mercado Pago');
    });

    it('avisa quando o usuário não é mais encontrado', () => {
        expect(auditActor({ actorId: 'removido', source: 'MANUAL' }, names)).toBe('Usuário não encontrado');
    });
});

describe('paymentSourceLabel', () => {
    it('diferencia a baixa manual do Pix confirmado', () => {
        expect(paymentSourceLabel('MANUAL')).toBe('Baixa manual pela equipe');
        expect(paymentSourceLabel('MERCADO_PAGO')).toBe('Pix confirmado pelo Mercado Pago');
    });

    it('usa o traço quando não há origem e o código quando é desconhecida', () => {
        expect(paymentSourceLabel(null)).toBe('—');
        expect(paymentSourceLabel('OUTRA')).toBe('OUTRA');
    });
});
