import api from './api';
import type { ChargesReport, IncidentsReport, OccupancyReport, ReportPeriod, ReservationsReport } from '../types/report';
export const reportService = {
    async occupancy() { return (await api.get<OccupancyReport>('/reports/occupancy')).data; },
    async charges(params: ReportPeriod) { return (await api.get<ChargesReport>('/reports/charges-summary', { params })).data; },
    async incidents(params: ReportPeriod) { return (await api.get<IncidentsReport>('/reports/incidents', { params })).data; },
    async reservations(params: ReportPeriod) { return (await api.get<ReservationsReport>('/reports/reservations', { params })).data; },
};
