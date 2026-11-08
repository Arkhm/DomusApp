import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Header from '../components/layout/Header';
import PageBody from '../components/luxury/PageBody';
import SectionHeader from '../components/luxury/SectionHeader';
import { useAuth } from '../hooks/useAuth';
import { hasPanelAccess } from '../lib/access';
import { apiErrorMessage } from '../lib/apiError';
import { reportService } from '../services/reportService';
import type { ReportPeriod } from '../types/report';
import { INCIDENT_CATEGORY_LABELS, INCIDENT_STATUS_LABELS } from '../types/incident';
import { RESERVATION_STATUS_LABELS } from '../types/reservation';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const percentage = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
function money(value: string) {
    const [whole, cents = '00'] = value.split('.');
    return currency.format(BigInt(whole)).replace(/,\d{2}/, ',' + cents);
}
const pct = (value: number) => percentage.format(value) + '%';
function initialPeriod(): ReportPeriod {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const endDate = ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
    const start = new Date(endDate + 'T12:00:00Z');
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() - 11);
    return { startDate: start.toISOString().slice(0, 10), endDate };
}
const colors = ['#b7a07a', '#6caa91', '#d79c5a', '#c97171'];
const label = (labels: Record<string, string>, key: string) => labels[key] ?? key;
function Chart({ data, series, percent = false, monetary = false }: {
    data: { name: string; [key: string]: unknown }[];
    series: { key: string; name: string }[];
    percent?: boolean; monetary?: boolean;
}) {
    return <div style={{ height: 300, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} accessibilityLayer margin={{ bottom: 30, left: 8, right: 12 }}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" height={70} tick={{ fill: 'var(--color-bone-dim)', fontSize: 11 }} />
                <YAxis width={monetary ? 110 : 60} allowDecimals={percent || monetary} domain={percent ? [0, 100] : undefined}
                    tickFormatter={value => percent ? pct(Number(value)) : monetary ? currency.format(Number(value)) : String(value)}
                    tick={{ fill: 'var(--color-bone-dim)', fontSize: 11 }} />
                <Tooltip formatter={(value, name, entry) => monetary
                    ? [money(entry.payload.exact[series.find(item => item.name === name)!.key]), name]
                    : percent ? pct(Number(value)) : value}
                    contentStyle={{ background: 'var(--color-obsidian)', borderColor: 'var(--color-line)' }} />
                <Legend />
                {series.map((item, index) => <Bar key={item.key} dataKey={item.key} name={item.name} stackId={monetary ? 'charges' : undefined}
                    fill={colors[index % colors.length]} isAnimationActive={false} />)}
            </BarChart>
        </ResponsiveContainer>
    </div>;
}
function Panel({ title, empty, children }: { title: string; empty: boolean; children: ReactNode }) {
    return <section className="luxe-card" style={{ padding: 24, minWidth: 0 }}>
        <h3 className="serif" style={{ fontSize: 26, marginBottom: 20 }}>{title}</h3>
        {empty ? <p>Nenhum dado encontrado para este relatório.</p> : children}
    </section>;
}
export default function Reports() {
    const { user } = useAuth();
    const allowed = hasPanelAccess(user);
    const [draft, setDraft] = useState(initialPeriod);
    const [period, setPeriod] = useState(draft);
    const [revision, setRevision] = useState(0);
    const [data, setData] = useState<{
        occupancy: Awaited<ReturnType<typeof reportService.occupancy>>;
        charges: Awaited<ReturnType<typeof reportService.charges>>;
        incidents: Awaited<ReturnType<typeof reportService.incidents>>;
        reservations: Awaited<ReturnType<typeof reportService.reservations>>;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filterError, setFilterError] = useState('');
    useEffect(() => {
        if (!allowed) return;
        let cancelled = false;
        setLoading(true);
        setError('');
        Promise.all([reportService.occupancy(), reportService.charges(period), reportService.incidents(period), reportService.reservations(period)])
            .then(([occupancy, charges, incidents, reservations]) => { if (!cancelled) setData({ occupancy, charges, incidents, reservations }); })
            .catch(err => { if (!cancelled) setError(apiErrorMessage(err, 'Não foi possível carregar os relatórios.')); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [allowed, period, revision]);
    if (!allowed) return <Navigate to="/dashboard" replace />;
    function apply(event: FormEvent) {
        event.preventDefault();
        if (draft.startDate > draft.endDate) { setFilterError('O início deve ser anterior ou igual ao fim.'); return; }
        const maxEnd = new Date(draft.startDate + 'T00:00:00Z');
        const month = maxEnd.getUTCMonth();
        maxEnd.setUTCFullYear(maxEnd.getUTCFullYear() + 2);
        if (maxEnd.getUTCMonth() !== month) maxEnd.setUTCDate(0);
        if (Date.parse(draft.endDate + 'T00:00:00Z') >= maxEnd.getTime()) { setFilterError('Selecione um período de até 24 meses.'); return; }
        setFilterError('');
        setPeriod({ ...draft });
    }
    return <div>
        <Header title="Relatórios" eyebrow="Gestão do condomínio" />
        <PageBody>
            <SectionHeader title="Relatórios gerenciais" subtitle="Indicadores de ocupação, cobranças, ocorrências e áreas comuns." />
            <form onSubmit={apply} style={{ display: 'flex', alignItems: 'end', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                <label>Data inicial<input className="luxe-input" type="date" required min="1000-01-01" max="9998-12-31" value={draft.startDate} onChange={event => setDraft({ ...draft, startDate: event.target.value })} /></label>
                <label>Data final<input className="luxe-input" type="date" required min="1000-01-01" max="9998-12-31" value={draft.endDate} onChange={event => setDraft({ ...draft, endDate: event.target.value })} /></label>
                <button className="btn-gold" disabled={loading} type="submit">Aplicar período</button>
            </form>
            {filterError && <p role="alert" style={{ color: 'var(--color-err)', marginBottom: 16 }}>{filterError}</p>}
            <p style={{ marginBottom: 24 }}>Datas inclusivas no calendário de São Paulo. Ocupação é um retrato atual e não depende do período.</p>
            {loading ? <p role="status">Carregando relatórios...</p> : error ? <div role="alert" className="luxe-card" style={{ padding: 24 }}>
                <p>{error}</p><button className="btn-ghost" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button>
            </div> : data && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: 24 }}>
                <Panel title="Ocupação por bloco" empty={!data.occupancy.total.total}>
                    <p>{data.occupancy.total.occupied} de {data.occupancy.total.total} unidades ocupadas · {pct(data.occupancy.total.occupancyRate)}</p>
                    <Chart percent data={data.occupancy.byBlock.map(row => ({ name: row.block, rate: row.occupancyRate }))} series={[{ key: 'rate', name: 'Ocupação (%)' }]} />
                    <table className="luxe-table"><caption>Unidades por bloco</caption><thead><tr><th>Bloco</th><th>Ocupadas / total</th><th>Taxa</th></tr></thead>
                        <tbody>{data.occupancy.byBlock.map(row => <tr key={row.block}><td>{row.block}</td><td>{row.occupied} / {row.total}</td><td>{pct(row.occupancyRate)}</td></tr>)}</tbody></table>
                </Panel>
                <Panel title="Inadimplência por mês" empty={!data.charges.summary.total.count}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
                        {([{ key: 'paid', title: 'Pagas' }, { key: 'pending', title: 'Pendentes' }, { key: 'overdue', title: 'Vencidas' }] as const).map(item => <div className="luxe-card" style={{ padding: 12 }} key={item.key}>
                            <p>{item.title} ({data.charges.summary[item.key].count})</p><strong>{money(data.charges.summary[item.key].amount)}</strong>
                        </div>)}
                        <div className="luxe-card" style={{ padding: 12 }}><p>Inadimplência</p><strong>{pct(data.charges.summary.delinquencyRate)}</strong></div>
                    </div>
                    <p>Valor vencido ÷ total pago, pendente e vencido. Outros estados não entram no cálculo.</p>
                    <Chart monetary data={data.charges.byMonth.map(row => ({ name: row.month, paid: Number(row.paid.amount), pending: Number(row.pending.amount), overdue: Number(row.overdue.amount),
                        exact: { paid: row.paid.amount, pending: row.pending.amount, overdue: row.overdue.amount } }))}
                        series={[{ key: 'paid', name: 'Pago' }, { key: 'pending', name: 'Pendente' }, { key: 'overdue', name: 'Vencido' }]} />
                    <div style={{ overflowX: 'auto' }}><table className="luxe-table"><caption>Valores por mês de vencimento</caption><thead><tr><th>Mês</th><th>Pago</th><th>Pendente</th><th>Vencido</th><th>Taxa</th></tr></thead>
                        <tbody>{data.charges.byMonth.map(row => <tr key={row.month}><td>{row.month}</td><td>{money(row.paid.amount)} ({row.paid.count})</td><td>{money(row.pending.amount)} ({row.pending.count})</td><td>{money(row.overdue.amount)} ({row.overdue.count})</td><td>{pct(row.delinquencyRate)}</td></tr>)}</tbody></table></div>
                </Panel>
                <Panel title="Ocorrências por categoria e status" empty={!data.incidents.total}>
                    <p>Total: {data.incidents.total} ocorrências registradas no período.</p>
                    <Chart data={data.incidents.byCategory.map(row => ({ name: label(INCIDENT_CATEGORY_LABELS, row.category), count: row.count }))} series={[{ key: 'count', name: 'Ocorrências por categoria' }]} />
                    <Chart data={data.incidents.byStatus.map(row => ({ name: label(INCIDENT_STATUS_LABELS, row.status), count: row.count }))} series={[{ key: 'count', name: 'Ocorrências por status atual' }]} />
                </Panel>
                <Panel title="Reservas por área comum" empty={!data.reservations.total}>
                    <p>Total: {data.reservations.total} solicitações. Inclui todos os status; aprovação não comprova uso efetivo.</p>
                    <Chart data={data.reservations.byArea.map(row => ({ name: row.areaName, ...Object.fromEntries(row.byStatus.map(item => [item.status, item.count])) }))} series={Object.entries(RESERVATION_STATUS_LABELS).map(([key, name]) => ({ key, name }))} />
                    <ul>{data.reservations.byStatus.map(row => <li key={row.status}>{label(RESERVATION_STATUS_LABELS, row.status)}: {row.count}</li>)}</ul>
                    <div style={{ overflowX: 'auto' }}><table className="luxe-table"><caption>Solicitações por área e status</caption><thead><tr><th>Área</th><th>Status</th><th>Quantidade</th></tr></thead>
                        <tbody>{data.reservations.byArea.flatMap(area => area.byStatus.map(row => <tr key={area.areaId + row.status}><td>{area.areaName}</td><td>{label(RESERVATION_STATUS_LABELS, row.status)}</td><td>{row.count}</td></tr>))}</tbody></table></div>
                </Panel>
            </div>}
        </PageBody>
    </div>;
}
