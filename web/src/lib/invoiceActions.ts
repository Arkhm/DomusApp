import axios from 'axios';
import { apiErrorMessage } from './apiError';
import { INVOICE_STATUS_LABELS, type Invoice } from '../types/invoice';

export type ActionKind = 'reconcile' | 'retry' | 'markPaid' | 'cancel';

export interface ActionAvailability {
    allowed: boolean;
    /** Por que não está disponível (vazio quando está). */
    hint: string;
}

export type InvoiceActions = Record<ActionKind, ActionAvailability>;

/** A API aceita justificativa de 1 a 191 caracteres; a tela pede ao menos 5 para não aceitar "x". */
export const REASON_MIN = 5;
export const REASON_MAX = 191;

export function validateReason(text: string): { value: string; error?: undefined } | { value?: undefined; error: string } {
    const value = text.trim();
    if (value.length < REASON_MIN) return { error: `Descreva o motivo (mínimo de ${REASON_MIN} caracteres).` };
    if (value.length > REASON_MAX) return { error: `Use até ${REASON_MAX} caracteres.` };
    return { value };
}

const MANUAL_STATUSES: ReadonlySet<string> = new Set(['PENDING', 'OVERDUE', 'EXPIRED', 'REJECTED']);
/** Situações do Pix em que o provedor já registrou pagamento ou estorno. */
const SETTLED_ISSUANCE: ReadonlySet<string> = new Set(['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGED_BACK']);

const ok: ActionAvailability = { allowed: true, hint: '' };
const no = (hint: string): ActionAvailability => ({ allowed: false, hint });

/**
 * Quais ações a cobrança aceita agora. Espelha as regras da API (`paymentService`) para a tela explicar o
 * bloqueio em vez de deixar a pessoa descobrir só pela recusa:
 *
 * - **Conciliar** confere o pedido no Mercado Pago; só há o que conciliar se existe Pix (ou registro legado).
 * - **Reenviar emissão** só vale para tentativa em revisão ou em nova tentativa que ainda não gerou pedido no provedor.
 * - **Baixa manual** (paga ou cancelada) vale para cobranças em aberto. Fica bloqueada com revisão pendente, legado,
 *   emissão em andamento sem pedido ou pagamento já registrado pelo provedor: nesses casos, concilie primeiro.
 */
export function availableActions(invoice: Pick<Invoice, 'status' | 'requiresReview' | 'issuanceStatus' | 'paymentData'>): InvoiceActions {
    const { status, requiresReview, issuanceStatus } = invoice;
    const hasOrder = !!invoice.paymentData?.mpOrderId;

    const reconcile = issuanceStatus === 'NOT_ISSUED'
        ? no('Cobrança sem Pix: não há o que conciliar com o Mercado Pago.') : ok;

    let retry: ActionAvailability = ok;
    if (issuanceStatus !== 'REVIEW' && issuanceStatus !== 'RETRY') retry = no('Só vale para emissões em nova tentativa ou em revisão.');
    else if (hasOrder) retry = no('O pedido já existe no Mercado Pago. Use Conciliar.');

    let manual: ActionAvailability = ok;
    if (!MANUAL_STATUSES.has(status)) {
        manual = no(`Cobranças com situação “${INVOICE_STATUS_LABELS[status] ?? status}” não aceitam alteração manual.`);
    } else if (requiresReview) {
        manual = no('A cobrança está marcada para revisão. Concilie com o Mercado Pago antes de alterar.');
    } else if (issuanceStatus === 'REVIEW' || issuanceStatus === 'LEGACY') {
        manual = no('A emissão está em revisão ou é de um registro legado. Concilie antes de alterar.');
    } else if (issuanceStatus === 'RETRY' || issuanceStatus === 'ISSUING') {
        manual = no('O Pix ainda está sendo emitido. Aguarde a emissão ou peça a nova tentativa.');
    } else if (SETTLED_ISSUANCE.has(issuanceStatus)) {
        manual = no('O Mercado Pago registrou pagamento ou estorno. Use Conciliar para revisar.');
    }

    return { reconcile, retry, markPaid: manual, cancel: manual };
}

export const ACTION_LABELS: Record<ActionKind, string> = {
    reconcile: 'Conciliar com o Mercado Pago',
    retry: 'Reenviar emissão do Pix',
    markPaid: 'Marcar como paga',
    cancel: 'Cancelar cobrança',
};

/** O que cada ação faz, em linguagem de quem vai confirmar. */
export const ACTION_EXPLANATIONS: Record<ActionKind, string> = {
    reconcile: 'Consulta o pedido no Mercado Pago e atualiza a cobrança com o que foi encontrado. Não emite nada novo.',
    retry: 'Pede ao sistema que tente gerar o Pix de novo, em segundo plano. Só é possível enquanto o pedido ainda não existe no Mercado Pago.',
    markPaid: 'Registra um pagamento recebido por fora do Pix (dinheiro, transferência...). Se houver Pix ativo, ele será encerrado no Mercado Pago. A ação não pode ser desfeita pela tela.',
    cancel: 'Cancela a cobrança. Se houver Pix ativo, ele será encerrado no Mercado Pago. A ação não pode ser desfeita pela tela.',
};

export const ACTION_CONFIRM_LABELS: Record<ActionKind, string> = {
    reconcile: 'Conciliar',
    retry: 'Reenviar emissão',
    markPaid: 'Confirmar pagamento',
    cancel: 'Confirmar cancelamento',
};

export const ACTION_SUCCESS: Record<ActionKind, string> = {
    reconcile: 'Conciliação concluída com o Mercado Pago.',
    retry: 'Reenvio solicitado. O Pix será gerado em segundo plano.',
    markPaid: 'Cobrança marcada como paga.',
    cancel: 'Cobrança cancelada.',
};

/** Ações que alteram o dinheiro de forma definitiva pela tela: pedem confirmação mais enfática. */
export const IRREVERSIBLE: ReadonlySet<ActionKind> = new Set(['markPaid', 'cancel']);

/** Mensagem para quando uma ação falha, com o que a pessoa deve fazer em cada caso. */
export function actionErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        if (!error.response) {
            return 'Sem resposta do servidor. A ação pode ter sido aplicada: os dados abaixo foram atualizados, confira o histórico antes de tentar de novo.';
        }
        const { status, data } = error.response as { status: number; data?: { error?: string; code?: string } };
        const message = data?.error ?? '';
        if (data?.code === 'PAYMENT_BUSY') return 'Outra operação está em andamento nesta cobrança. Aguarde alguns segundos e tente de novo.';
        if (data?.code === 'REVIEW_REQUIRED' || data?.code === 'LEGACY_REVIEW') return `${message} Use Conciliar para revisar a cobrança.`;
        if (data?.code === 'CANCELLATION_UNCONFIRMED') return `${message} O Mercado Pago ainda não confirmou o encerramento.`;
        if (status === 503) return `${message || 'Não foi possível concluir a operação no Mercado Pago.'} Tente de novo em instantes; se persistir, procure a equipe técnica.`;
    }
    return apiErrorMessage(error, 'Não foi possível concluir a ação.');
}

/** Mensagem para quando carregar a cobrança ou o histórico falha. Sem resposta do servidor, evita o "Network Error" do axios. */
export function loadErrorMessage(error: unknown, fallback: string): string {
    if (axios.isAxiosError(error) && !error.response) return `${fallback} Verifique a conexão e tente de novo.`;
    return apiErrorMessage(error, fallback);
}
