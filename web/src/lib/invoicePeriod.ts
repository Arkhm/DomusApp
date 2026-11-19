import { monthEndShifted, monthStartShifted } from './invoiceFormat';

export interface SummaryPeriod { startDate: string; endDate: string }

/** O relatório da API aceita períodos de no máximo 24 meses. */
export const SUMMARY_LIMIT_MESSAGE = 'O resumo cobre no máximo 24 meses. Reduza o período para ver os totais.';

/** Um ano antes de `date`, mantendo o mês (29/02 cai em 28/02). Datas AAAA-MM-DD. */
function plusTwoYears(date: string): string {
    const value = new Date(date + 'T00:00:00Z');
    const month = value.getUTCMonth();
    value.setUTCFullYear(value.getUTCFullYear() + 2);
    if (value.getUTCMonth() !== month) value.setUTCDate(0);
    return value.toISOString().slice(0, 10);
}

/** Último dia que a API aceita para um período que começa em `startDate` (a regra dela é "antes do 2º aniversário"). */
export function maxSummaryEnd(startDate: string): string {
    const limit = new Date(plusTwoYears(startDate) + 'T00:00:00Z');
    limit.setUTCDate(limit.getUTCDate() - 1);
    return limit.toISOString().slice(0, 10);
}

/**
 * Período do resumo a partir dos filtros de vencimento (datas AAAA-MM-DD, vazias como '').
 *
 * - Sem datas: últimos 12 meses e próximos 6, para incluir o que ainda vai vencer.
 * - Só o fim: 12 meses terminando nele (o mesmo padrão da API).
 * - Só o início: até o fim padrão; se ele ficar antes do início, 12 meses a partir do início;
 *   e nunca além do limite de 24 meses.
 * - As duas datas: exatamente o que foi pedido.
 *
 * A legenda da tela deve mostrar o período que este cálculo devolveu, não o que foi digitado.
 */
export function summaryPeriod(filters: { startDate: string; endDate: string }, today: string): SummaryPeriod {
    const defaultEnd = monthEndShifted(today, 6);
    const { startDate, endDate } = filters;
    if (startDate && endDate) return { startDate, endDate };
    if (endDate) return { startDate: monthStartShifted(endDate, -11), endDate };
    if (startDate) {
        const end = defaultEnd < startDate ? monthEndShifted(startDate, 11) : defaultEnd;
        const limit = maxSummaryEnd(startDate);
        return { startDate, endDate: end > limit ? limit : end };
    }
    return { startDate: monthStartShifted(today, -11), endDate: defaultEnd };
}

/** Mensagem quando o período pedido não cabe no relatório; vazia quando está tudo certo. */
export function summaryPeriodIssue(period: SummaryPeriod): string {
    if (period.startDate > period.endDate) return '';
    return period.endDate > maxSummaryEnd(period.startDate) ? SUMMARY_LIMIT_MESSAGE : '';
}
