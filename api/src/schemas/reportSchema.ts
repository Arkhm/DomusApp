import { z } from 'zod';

const calendarDate = z.iso.date({ error: 'Informe uma data válida no formato AAAA-MM-DD.' })
  .refine(value => value >= '1000-01-01' && value <= '9998-12-31', 'Data fora do intervalo suportado.');
export const reportQuerySchema = z.object({
  startDate: calendarDate.optional(),
  endDate: calendarDate.optional(),
});
export type ReportFilters = z.infer<typeof reportQuerySchema>;

const zone = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
export function reportToday(now = new Date()): string {
  const parts = zone.formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}
export function nextDay(date: string): string {
  return new Date(Date.parse(date + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
}
export function monthStart(date: string, offset = 0): string {
  const value = new Date(date + 'T00:00:00Z');
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + offset);
  return value.toISOString().slice(0, 10);
}
const offsetFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', timeZoneName: 'longOffset' });
export function saoPauloDayStart(date: string): Date {
  const utc = new Date(date + 'T00:00:00Z');
  // O offset antes da meia-noite também cobre o dia que começa à 01h na entrada do horário de verão.
  const offset = offsetFormatter.formatToParts(utc).find(part => part.type === 'timeZoneName')!.value;
  const match = offset.match(/GMT([+-])(\d{2}):(\d{2})(?::(\d{2}))?/)!;
  const minutes = (Number(match[2]) * 60 + Number(match[3]) + Number(match[4] ?? 0) / 60) * (match[1] === '+' ? 1 : -1);
  const candidate = new Date(utc.getTime() - minutes * 60000);
  // Na saída do horário de verão, a meia-noite só chega depois da hora repetida.
  if (reportToday(candidate) !== date) {
    const after = offsetFormatter.formatToParts(new Date(utc.getTime() + 43200000)).find(part => part.type === 'timeZoneName')!.value;
    const next = after.match(/GMT([+-])(\d{2}):(\d{2})(?::(\d{2}))?/)!;
    const nextMinutes = (Number(next[2]) * 60 + Number(next[3]) + Number(next[4] ?? 0) / 60) * (next[1] === '+' ? 1 : -1);
    return new Date(utc.getTime() - nextMinutes * 60000);
  }
  return candidate;
}
export function resolveReportPeriod(filters: ReportFilters, now = new Date()) {
  const endDate = filters.endDate ?? reportToday(now);
  const defaultStart = monthStart(endDate, -11);
  const startDate = filters.startDate ?? (defaultStart < '1000-01-01' ? '1000-01-01' : defaultStart);
  return { startDate, endDate };
}
export const reportPeriodSchema = reportQuerySchema.transform(filters => resolveReportPeriod(filters)).superRefine((period, ctx) => {
  if (period.startDate > period.endDate) ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'O início deve ser anterior ou igual ao fim.' });
  const anniversary = new Date(period.startDate + 'T00:00:00Z');
  const originalMonth = anniversary.getUTCMonth();
  anniversary.setUTCFullYear(anniversary.getUTCFullYear() + 2);
  if (anniversary.getUTCMonth() !== originalMonth) anniversary.setUTCDate(0);
  if (Date.parse(period.endDate + 'T00:00:00Z') >= anniversary.getTime()) {
    ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'O período deve ter no máximo 24 meses.' });
  }
});
export type ReportPeriod = z.infer<typeof reportPeriodSchema>;
