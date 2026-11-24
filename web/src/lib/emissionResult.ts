import { ISSUANCE_IN_FLIGHT, ISSUANCE_LABELS, type Invoice } from '../types/invoice';

export interface IssuanceTally {
    total: number;
    /** Pix disponível para o morador pagar. */
    active: number;
    /** Ainda na fila, em nova tentativa ou sendo emitido. */
    inFlight: number;
    /** A emissão precisa de revisão da administração. */
    review: number;
    /** Qualquer outra situação (sem Pix, legado, já encerrada...). */
    other: number;
}

export function tallyIssuance(invoices: Pick<Invoice, 'issuanceStatus'>[]): IssuanceTally {
    const tally: IssuanceTally = { total: invoices.length, active: 0, inFlight: 0, review: 0, other: 0 };
    for (const { issuanceStatus } of invoices) {
        if (issuanceStatus === 'ACTIVE') tally.active++;
        else if (ISSUANCE_IN_FLIGHT.has(issuanceStatus)) tally.inFlight++;
        else if (issuanceStatus === 'REVIEW') tally.review++;
        else tally.other++;
    }
    return tally;
}

export interface ResultMessage {
    text: string;
    /** Há algo que a administração precisa olhar. */
    needsAttention: boolean;
}

/**
 * Mensagem do resultado de um lote. A resposta do lote só diz que as cobranças foram criadas; o Pix de cada uma
 * pode já estar ativo, estar sendo gerado, ter ido para revisão ou ter outra situação. A mensagem não afirma
 * que tudo está disponível sem conferir cada estado.
 */
export function describeBatchResult(tally: IssuanceTally): ResultMessage {
    if (tally.total === 0) return { text: 'Nenhuma cobrança foi criada.', needsAttention: true };
    const created = `${tally.total} ${tally.total === 1 ? 'cobrança criada' : 'cobranças criadas'}.`;
    if (tally.active === tally.total) return { text: `${created} Os Pix já estão disponíveis.`, needsAttention: false };
    const parts: string[] = [];
    if (tally.active) parts.push(`Pix disponíveis: ${tally.active}.`);
    if (tally.inFlight) parts.push(`Em geração em segundo plano: ${tally.inFlight}; a lista se atualiza sozinha.`);
    if (tally.review) parts.push(`Em revisão: ${tally.review}. Elas precisam de atenção, confira a coluna Pix da lista.`);
    if (tally.other) parts.push(`Com outra situação: ${tally.other}. Confira a coluna Pix da lista.`);
    return { text: [created, ...parts].join(' '), needsAttention: tally.review > 0 || tally.other > 0 };
}

export type ResultTone = 'ok' | 'warn' | 'err';

/** Mensagem do resultado de uma emissão individual, conforme a situação do Pix devolvida pela API. */
export function describeSingleResult(issuanceStatus: string): ResultMessage & { tone: ResultTone } {
    if (issuanceStatus === 'ACTIVE') {
        return { text: 'O Pix foi gerado e já está disponível para o morador pagar.', needsAttention: false, tone: 'ok' };
    }
    if (ISSUANCE_IN_FLIGHT.has(issuanceStatus)) {
        return { text: 'A cobrança foi registrada e o Pix está sendo gerado. Acompanhe pela coluna Pix da lista.', needsAttention: false, tone: 'warn' };
    }
    if (issuanceStatus === 'REVIEW') {
        return { text: 'A cobrança foi registrada, mas a geração do Pix precisa de revisão. Confira a coluna Pix da lista.', needsAttention: true, tone: 'err' };
    }
    const label = ISSUANCE_LABELS[issuanceStatus] ?? issuanceStatus;
    return { text: `A cobrança foi registrada, mas a situação do Pix é “${label}”. Confira a coluna Pix da lista.`, needsAttention: true, tone: 'warn' };
}
