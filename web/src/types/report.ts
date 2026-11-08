export interface ReportPeriod { startDate: string; endDate: string }
export interface OccupancyReport {
    byBlock: { block: string; total: number; occupied: number; occupancyRate: number }[];
    total: { total: number; occupied: number; occupancyRate: number };
}
export interface ChargeBucket { count: number; amount: string }
export interface ChargeSummary {
    paid: ChargeBucket; pending: ChargeBucket; overdue: ChargeBucket; total: ChargeBucket; delinquencyRate: number;
}
export interface ChargesReport { period: ReportPeriod; summary: ChargeSummary; byMonth: (ChargeSummary & { month: string })[] }
export interface IncidentsReport {
    period: ReportPeriod; total: number;
    byCategory: { category: string; count: number }[];
    byStatus: { status: string; count: number }[];
}
export interface ReservationsReport {
    period: ReportPeriod; total: number;
    byArea: { areaId: string; areaName: string; count: number; byStatus: { status: string; count: number }[] }[];
    byStatus: { status: string; count: number }[];
}
