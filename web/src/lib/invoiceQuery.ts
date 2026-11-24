import { todayBR } from './invoiceFormat';
import type { InvoiceFilters, InvoiceStatus, InvoiceType } from '../types/invoice';

/** Filtros como a tela os guarda: datas AAAA-MM-DD, vazios como ''. */
export interface InvoiceFilterState {
    status: InvoiceStatus | '';
    type: InvoiceType | '';
    unitId: string;
    startDate: string;
    endDate: string;
}

export const EMPTY_FILTERS: InvoiceFilterState = { status: '', type: '', unitId: '', startDate: '', endDate: '' };

export const RANGE_ERROR_MESSAGE = 'O vencimento inicial deve ser anterior ou igual ao final.';

/** Só há intervalo invertido quando as duas datas estão preenchidas. */
export function filterRangeError(filters: Pick<InvoiceFilterState, 'startDate' | 'endDate'>): string {
    return filters.startDate && filters.endDate && filters.startDate > filters.endDate ? RANGE_ERROR_MESSAGE : '';
}

export type InvoiceQuery =
    | { kind: 'query'; params: InvoiceFilters }
    /** O filtro não pode ter resultado (ex.: "Pendente" com vencimento final já no passado): não vale consultar a API. */
    | { kind: 'empty' };

/**
 * Converte os filtros da tela nos parâmetros de `GET /invoices/all`.
 *
 * - **Vencimento final:** vai como o fim do dia (23:59:59.999Z). A API compara com `<=`, e uma data só
 *   com dia equivale à meia-noite, o que deixaria de fora qualquer cobrança com hora naquele dia. O
 *   resumo, ao contrário, conta o dia inteiro; com isto a lista e o resumo passam a concordar.
 * - **Status "Pendente":** a API devolve as gravadas como pendentes, inclusive as já vencidas, que a tela
 *   mostra como "Vencida". Para a lista bater com o rótulo (e com o cartão "A vencer"), só entram as que
 *   vencem de agora em diante, a mesma fronteira que a API usa para "vencida" (`vencimento < agora`).
 */
export function buildInvoiceQuery(filters: InvoiceFilterState, page: number, limit: number, now: Date = new Date()): InvoiceQuery {
    now = new Date(`${todayBR(now)}T00:00:00.000Z`);
    const endsAt = filters.endDate ? new Date(`${filters.endDate}T23:59:59.999Z`) : null;
    let startParam = filters.startDate || undefined;
    let startsAt = startParam ? new Date(`${startParam}T00:00:00.000Z`) : null;
    if (filters.status === 'PENDING' && (!startsAt || startsAt < now)) {
        startsAt = now;
        startParam = now.toISOString();
    }
    if (startsAt && endsAt && startsAt > endsAt) return { kind: 'empty' };
    return {
        kind: 'query',
        params: {
            status: filters.status || undefined,
            type: filters.type || undefined,
            unitId: filters.unitId || undefined,
            startDate: startParam,
            endDate: endsAt ? endsAt.toISOString() : undefined,
            page,
            limit,
        },
    };
}
