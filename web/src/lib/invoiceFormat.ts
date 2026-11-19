const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Formata um valor decimal vindo da API ("350.00") sem passar por ponto flutuante. */
export function formatMoneyBR(value: string | number): string {
    const text = typeof value === 'number' ? value.toFixed(2) : value;
    if (!/^\d+(\.\d+)?$/.test(text)) return String(value);
    const [whole, cents = '00'] = text.split('.');
    return currency.format(BigInt(whole)).replace(/,\d{2}/, ',' + cents.padEnd(2, '0').slice(0, 2));
}

/** O vencimento é um dia de calendário gravado à meia-noite UTC: formatar em UTC evita mostrar o dia anterior. */
const dueDateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
export function formatDueDateBR(value: string): string {
    return dueDateFormatter.format(new Date(value));
}

const todayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
/** Hoje em Brasília, como AAAA-MM-DD (o formato que a API aceita nos filtros). */
export function todayBR(): string {
    const parts = todayFormatter.formatToParts(new Date());
    return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}

/** Primeiro dia do mês, deslocado `months` meses (negativo volta no tempo). Datas AAAA-MM-DD. */
export function monthStartShifted(date: string, months: number): string {
    const value = new Date(date + 'T00:00:00Z');
    value.setUTCDate(1);
    value.setUTCMonth(value.getUTCMonth() + months);
    return value.toISOString().slice(0, 10);
}

/** Último dia do mês, deslocado `months` meses. Datas AAAA-MM-DD. */
export function monthEndShifted(date: string, months: number): string {
    const value = new Date(monthStartShifted(date, months + 1) + 'T00:00:00Z');
    value.setUTCDate(0);
    return value.toISOString().slice(0, 10);
}
