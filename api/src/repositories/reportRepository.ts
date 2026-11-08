import { Prisma, IncidentCategory, IncidentStatus, ReservationStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ReportPeriod, monthStart, nextDay, saoPauloDayStart } from '../schemas/reportSchema';

export type OccupancyRow = { block: string; total: bigint; occupied: bigint | Prisma.Decimal };
export type ChargeRow = { month: string; status: 'PAID' | 'PENDING' | 'OVERDUE'; count: bigint; amount: Prisma.Decimal };
export type ReservationRow = { areaId: string; areaName: string; status: ReservationStatus; count: bigint };

export const reportRepository = {
  occupancy() {
    return prisma.$queryRaw<OccupancyRow[]>`
      SELECT COALESCE(NULLIF(TRIM(u.block), ''), 'Sem bloco') AS block, COUNT(*) AS total,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM User r WHERE r.unitId = u.id
          AND r.role = 'MORADOR' AND r.status = 'ACTIVE') THEN 1 ELSE 0 END) AS occupied
      FROM Unit u GROUP BY COALESCE(NULLIF(TRIM(u.block), ''), 'Sem bloco') ORDER BY block
    `;
  },

  charges(period: ReportPeriod, now: Date) {
    const months: Prisma.Sql[] = [];
    for (let date = monthStart(period.startDate); date <= period.endDate; date = monthStart(date, 1)) {
      const start = date < period.startDate ? period.startDate : date;
      const following = monthStart(date, 1);
      const end = following > period.endDate ? nextDay(period.endDate) : following;
      months.push(Prisma.sql`SELECT ${date.slice(0, 7)} AS month,
        CAST(${new Date(start + 'T00:00:00Z')} AS DATETIME(3)) AS startsAt,
        CAST(${new Date(end + 'T00:00:00Z')} AS DATETIME(3)) AS endsAt`);
    }
    // Vencimentos seguem o calendário UTC usado ao cadastrar faturas com AAAA-MM-DD.
    return prisma.$queryRaw<ChargeRow[]>(Prisma.sql`
      SELECT classified.month, classified.status, COUNT(*) AS count, SUM(classified.amount) AS amount
      FROM (SELECT calendar.month,
        CASE WHEN i.status = 'OVERDUE' OR (i.status = 'PENDING' AND i.dueDate < ${now})
          THEN 'OVERDUE' ELSE i.status END AS status, i.amount
      FROM Invoice i JOIN (${Prisma.join(months, ' UNION ALL ')}) calendar
        ON i.dueDate >= calendar.startsAt AND i.dueDate < calendar.endsAt
      WHERE i.status IN ('PAID', 'PENDING', 'OVERDUE')) classified
      GROUP BY classified.month, classified.status ORDER BY classified.month, classified.status
    `);
  },

  async incidents(period: ReportPeriod) {
    const where = { createdAt: { gte: saoPauloDayStart(period.startDate), lt: saoPauloDayStart(nextDay(period.endDate)) } };
    return prisma.$transaction(async tx => {
      const byCategory = await tx.incident.groupBy({ by: ['category'], where, _count: { _all: true }, orderBy: { category: 'asc' } });
      const byStatus = await tx.incident.groupBy({ by: ['status'], where, _count: { _all: true }, orderBy: { status: 'asc' } });
      return {
        byCategory: byCategory.map(row => ({ category: row.category as IncidentCategory, count: row._count._all })),
        byStatus: byStatus.map(row => ({ status: row.status as IncidentStatus, count: row._count._all })),
      };
    });
  },

  reservations(period: ReportPeriod) {
    // Reservation.date é um dia civil armazenado às 00:00 UTC, não o instante de início da reserva.
    const start = new Date(period.startDate + 'T00:00:00Z');
    const end = new Date(nextDay(period.endDate) + 'T00:00:00Z');
    return prisma.$queryRaw<ReservationRow[]>`
      SELECT a.id AS areaId, a.name AS areaName, r.status, COUNT(*) AS count
      FROM Reservation r JOIN CommonArea a ON a.id = r.commonAreaId
      WHERE r.date >= ${start} AND r.date < ${end}
      GROUP BY a.id, a.name, r.status ORDER BY a.name, a.id, r.status
    `;
  },
};
