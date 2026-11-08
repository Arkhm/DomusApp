import { Prisma } from '@prisma/client';
import { hasPanelAccess, UpdateActor } from '../lib/access';
import { HttpError } from '../lib/httpError';
import { reportRepository } from '../repositories/reportRepository';
import { ReportPeriod, reportPeriodSchema } from '../schemas/reportSchema';

function requirePanel(actor: UpdateActor) {
  if (!hasPanelAccess(actor)) throw new HttpError(403, 'Apenas a gestão pode consultar relatórios.');
}
function periodFor(actor: UpdateActor, input: unknown): ReportPeriod {
  requirePanel(actor);
  const parsed = reportPeriodSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]!.message);
  return parsed.data;
}
const percent = (part: number, total: number) => total ? Math.round(part / total * 1000) / 10 : 0;
const bucket = () => ({ count: 0, amount: '0.00' });
const chargeSummary = () => ({ paid: bucket(), pending: bucket(), overdue: bucket(), total: bucket(), delinquencyRate: 0 });
function finish(summary: ReturnType<typeof chargeSummary>) {
  summary.total.count = summary.paid.count + summary.pending.count + summary.overdue.count;
  summary.total.amount = new Prisma.Decimal(summary.paid.amount).plus(summary.pending.amount).plus(summary.overdue.amount).toFixed(2);
  summary.delinquencyRate = new Prisma.Decimal(summary.total.amount).isZero() ? 0
    : new Prisma.Decimal(summary.overdue.amount).div(summary.total.amount).times(100).toDecimalPlaces(1).toNumber();
  return summary;
}

export const reportService = {
  async occupancy(actor: UpdateActor) {
    requirePanel(actor);
    const rows = await reportRepository.occupancy();
    const byBlock = rows.map(row => ({ block: row.block, total: Number(row.total), occupied: Number(row.occupied),
      occupancyRate: percent(Number(row.occupied), Number(row.total)) }));
    const total = byBlock.reduce((sum, row) => ({ total: sum.total + row.total, occupied: sum.occupied + row.occupied }), { total: 0, occupied: 0 });
    return { byBlock, total: { ...total, occupancyRate: percent(total.occupied, total.total) } };
  },

  async chargesSummary(actor: UpdateActor, input: unknown = {}) {
    const period = periodFor(actor, input);
    const rows = await reportRepository.charges(period, new Date());
    const months = new Map<string, ReturnType<typeof chargeSummary>>();
    const summary = chargeSummary();
    for (const row of rows) {
      const current = months.get(row.month) ?? chargeSummary();
      months.set(row.month, current);
      const key = { PAID: 'paid', PENDING: 'pending', OVERDUE: 'overdue' }[row.status] as 'paid' | 'pending' | 'overdue';
      for (const target of [current, summary]) {
        target[key].count += Number(row.count);
        // money() valida uma única cobrança (> 0 e teto individual); somas admitem zero e ultrapassam esse teto.
        target[key].amount = new Prisma.Decimal(target[key].amount).plus(row.amount).toFixed(2);
      }
    }
    return { period, summary: finish(summary), byMonth: [...months].map(([month, value]) => ({ month, ...finish(value) })) };
  },

  async incidents(actor: UpdateActor, input: unknown = {}) {
    const period = periodFor(actor, input);
    const result = await reportRepository.incidents(period);
    return { period, total: result.byStatus.reduce((total, row) => total + row.count, 0), ...result };
  },

  async reservations(actor: UpdateActor, input: unknown = {}) {
    const period = periodFor(actor, input);
    const rows = await reportRepository.reservations(period);
    const areas = new Map<string, { areaId: string; areaName: string; count: number; byStatus: { status: string; count: number }[] }>();
    const statuses = new Map<string, number>();
    for (const row of rows) {
      const count = Number(row.count);
      const area = areas.get(row.areaId) ?? { areaId: row.areaId, areaName: row.areaName, count: 0, byStatus: [] };
      area.count += count;
      area.byStatus.push({ status: row.status, count });
      areas.set(row.areaId, area);
      statuses.set(row.status, (statuses.get(row.status) ?? 0) + count);
    }
    const byStatus = [...statuses].map(([status, count]) => ({ status, count }));
    return { period, total: byStatus.reduce((sum, row) => sum + row.count, 0), byArea: [...areas.values()], byStatus };
  },
};
