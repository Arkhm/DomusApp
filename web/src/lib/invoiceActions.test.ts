import { AxiosError, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { REASON_MAX, REASON_MIN, actionErrorMessage, availableActions, loadErrorMessage, validateReason } from './invoiceActions';
import type { Invoice, InvoiceStatus } from '../types/invoice';

type Subject = Pick<Invoice, 'status' | 'requiresReview' | 'issuanceStatus' | 'paymentData'>;
const subject = (patch: Partial<Subject> & { mpOrderId?: string | null } = {}): Subject => {
    const { mpOrderId = null, ...rest } = patch;
    return {
        status: 'PENDING', requiresReview: false, issuanceStatus: 'ACTIVE',
        paymentData: { qrCode: null, qrCodeBase64: null, ticketUrl: null, mpOrderId, mpStatus: null }, ...rest,
    };
};
const allowed = (invoice: Subject) => Object.fromEntries(Object.entries(availableActions(invoice)).map(([kind, a]) => [kind, a.allowed]));

describe('validateReason', () => {
    it('aceita justificativa entre o mínimo e o máximo, aparando espaços', () => {
        expect(validateReason('  pagou em dinheiro  ')).toEqual({ value: 'pagou em dinheiro' });
        expect(validateReason('x'.repeat(REASON_MAX)).value).toHaveLength(REASON_MAX);
    });

    it('recusa vazio, curto demais e longo demais (o limite de 191 é o da API)', () => {
        expect(validateReason('').error).toMatch(/mínimo/);
        expect(validateReason('   ').error).toMatch(/mínimo/);
        expect(validateReason('x'.repeat(REASON_MIN - 1)).error).toMatch(/mínimo/);
        expect(validateReason('x'.repeat(REASON_MAX + 1)).error).toMatch(/até 191/);
    });
});

describe('availableActions', () => {
    it('Pix ativo e em aberto: conciliar, baixa e cancelamento; não reenvia (o pedido já existe)', () => {
        expect(allowed(subject({ mpOrderId: 'ORD1' }))).toEqual({ reconcile: true, retry: false, markPaid: true, cancel: true });
    });

    it('cobrança sem Pix (demonstração): só baixa e cancelamento', () => {
        const actions = availableActions(subject({ issuanceStatus: 'NOT_ISSUED' }));
        expect(allowed(subject({ issuanceStatus: 'NOT_ISSUED' }))).toEqual({ reconcile: false, retry: false, markPaid: true, cancel: true });
        expect(actions.reconcile.hint).toMatch(/sem Pix/);
    });

    it('na fila: pode dar baixa ou cancelar (a API cancela a tentativa que ainda não saiu)', () => {
        expect(allowed(subject({ issuanceStatus: 'QUEUED' })).cancel).toBe(true);
    });

    it('nova tentativa ou emissão em andamento, sem pedido: baixa manual bloqueada; só a nova tentativa pode ser reenviada', () => {
        const retrying = availableActions(subject({ issuanceStatus: 'RETRY' }));
        expect(retrying.retry.allowed).toBe(true);
        expect(retrying.markPaid.allowed).toBe(false);
        expect(retrying.markPaid.hint).toMatch(/sendo emitido/);
        expect(availableActions(subject({ issuanceStatus: 'ISSUING' })).markPaid.allowed).toBe(false);
        expect(availableActions(subject({ issuanceStatus: 'ISSUING' })).retry.allowed).toBe(false);
    });

    it('em revisão: reenvia (sem pedido) e concilia, mas não altera manualmente', () => {
        const review = availableActions(subject({ issuanceStatus: 'REVIEW', requiresReview: true }));
        expect(review.retry.allowed).toBe(true);
        expect(review.reconcile.allowed).toBe(true);
        expect(review.cancel.allowed).toBe(false);
        expect(review.cancel.hint).toMatch(/revisão/);
    });

    it('Pix ativo, mas marcado para revisão (ex.: pagamento após a baixa manual): só concilia', () => {
        const flagged = availableActions(subject({ requiresReview: true, mpOrderId: 'ORD1' }));
        expect(flagged.markPaid.allowed).toBe(false);
        expect(flagged.cancel.hint).toMatch(/marcada para revisão/);
        expect(flagged.reconcile.allowed).toBe(true);
    });

    it('em revisão com pedido no provedor: manda conciliar em vez de reenviar', () => {
        const review = availableActions(subject({ issuanceStatus: 'REVIEW', requiresReview: true, mpOrderId: 'ORD1' }));
        expect(review.retry.allowed).toBe(false);
        expect(review.retry.hint).toMatch(/Conciliar/);
    });

    it('legado: só concilia', () => {
        const legacy = availableActions(subject({ issuanceStatus: 'LEGACY', mpOrderId: 'ORD1' }));
        expect(legacy.reconcile.allowed).toBe(true);
        expect(legacy.markPaid.allowed).toBe(false);
    });

    it('pagamento ou estorno já registrado pelo provedor: só concilia', () => {
        for (const issuanceStatus of ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGED_BACK']) {
            const actions = availableActions(subject({ issuanceStatus, mpOrderId: 'ORD1' }));
            expect(actions.cancel.allowed, issuanceStatus).toBe(false);
            expect(actions.reconcile.allowed, issuanceStatus).toBe(true);
        }
    });

    it('Pix expirado, recusado ou cancelado no provedor: a baixa manual continua possível (ex.: pagou em dinheiro)', () => {
        for (const issuanceStatus of ['EXPIRED', 'REJECTED', 'CANCELLED']) {
            expect(availableActions(subject({ issuanceStatus, mpOrderId: 'ORD1' })).markPaid.allowed, issuanceStatus).toBe(true);
        }
    });

    it('situações encerradas não aceitam alteração manual, com a situação no aviso', () => {
        for (const status of ['PAID', 'CANCELLED', 'REFUNDED', 'CHARGED_BACK', 'PARTIALLY_REFUNDED'] as InvoiceStatus[]) {
            const actions = availableActions(subject({ status, issuanceStatus: 'NOT_ISSUED' }));
            expect(actions.markPaid.allowed, status).toBe(false);
            expect(actions.cancel.hint, status).toMatch(/não aceitam alteração manual/);
        }
        expect(availableActions(subject({ status: 'PAID', issuanceStatus: 'NOT_ISSUED' })).cancel.hint).toMatch(/“Paga”/);
    });

    it('cobranças vencidas, expiradas ou recusadas são "em aberto" para a baixa manual', () => {
        for (const status of ['PENDING', 'OVERDUE', 'EXPIRED', 'REJECTED'] as InvoiceStatus[]) {
            expect(availableActions(subject({ status, issuanceStatus: 'NOT_ISSUED' })).cancel.allowed, status).toBe(true);
        }
    });
});

describe('actionErrorMessage', () => {
    const failure = (status: number, data: unknown) =>
        new AxiosError('falhou', 'ERR_BAD_RESPONSE', undefined, undefined, { status, data } as AxiosResponse);

    it('sem resposta: avisa que a ação pode ter sido aplicada e que o histórico foi atualizado', () => {
        const message = actionErrorMessage(new AxiosError('Network Error', 'ERR_NETWORK'));
        expect(message).toMatch(/Sem resposta do servidor/);
        expect(message).toMatch(/pode ter sido aplicada/);
    });

    it('revisão necessária: orienta a conciliar', () => {
        expect(actionErrorMessage(failure(409, { error: 'Pagamento exige revisão antes da alteração.', code: 'REVIEW_REQUIRED' })))
            .toBe('Pagamento exige revisão antes da alteração. Use Conciliar para revisar a cobrança.');
    });

    it('operação em andamento: pede para aguardar', () => {
        expect(actionErrorMessage(failure(409, { error: 'x', code: 'PAYMENT_BUSY' }))).toMatch(/Aguarde alguns segundos/);
    });

    it('encerramento não confirmado e Mercado Pago indisponível', () => {
        expect(actionErrorMessage(failure(409, { error: 'Encerramento do Pix não confirmado. Tente novamente.', code: 'CANCELLATION_UNCONFIRMED' }))).toMatch(/ainda não confirmou/);
        expect(actionErrorMessage(failure(503, { error: 'Não foi possível concluir a operação no Mercado Pago.', code: 'MP_HTTP_500' }))).toMatch(/Tente de novo em instantes/);
    });

    it('outros erros usam a mensagem da API', () => {
        expect(actionErrorMessage(failure(400, { error: 'Justificativa inválido.' }))).toBe('Justificativa inválido.');
    });
});

describe('loadErrorMessage', () => {
    it('sem resposta do servidor, não mostra o "Network Error" em inglês', () => {
        const message = loadErrorMessage(new AxiosError('Network Error', 'ERR_NETWORK'), 'Não foi possível carregar o histórico.');
        expect(message).toBe('Não foi possível carregar o histórico. Verifique a conexão e tente de novo.');
    });

    it('com resposta da API, usa a mensagem dela', () => {
        const error = new AxiosError('falhou', 'ERR_BAD_RESPONSE', undefined, undefined, { status: 404, data: { error: 'Fatura não encontrada.' } } as AxiosResponse);
        expect(loadErrorMessage(error, 'Não foi possível carregar o histórico.')).toBe('Fatura não encontrada.');
    });
});
