import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, RefreshCw, Users } from 'lucide-react';
import Header from '../../components/layout/Header';
import PageBody from '../../components/luxury/PageBody';
import SectionHeader from '../../components/luxury/SectionHeader';
import Tag from '../../components/luxury/Tag';
import { EmptyTable, FilterSelect, ListMeta } from '../../components/luxury/ListHelpers';
import { useAuth } from '../../hooks/useAuth';
import { apiErrorMessage } from '../../lib/apiError';
import { formatDueDateBR, formatMoneyBR, monthEndShifted, monthStartShifted, todayBR } from '../../lib/invoiceFormat';
import { invoiceService } from '../../services/invoiceService';
import { reportService } from '../../services/reportService';
import { unitService } from '../../services/unitService';
import {
    INVOICE_STATUS_LABELS, INVOICE_TYPE_LABELS, ISSUANCE_IN_FLIGHT, ISSUANCE_LABELS, effectiveInvoiceStatus,
    type InvoiceFilters, type InvoicePage, type InvoiceStatus, type InvoiceType,
} from '../../types/invoice';
import type { ChargesReport } from '../../types/report';
import { formatUnitDisplay, type Unit } from '../../types/user';
import InvoiceBatchModal from './InvoiceBatchModal';
import InvoiceFormModal from './InvoiceFormModal';

const PAGE_SIZE = 20;
// Enquanto há Pix sendo gerado, a lista se atualiza sozinha a cada 8 s, por no máximo 30 vezes (4 minutos).
// Depois disso o botão "Atualizar" continua disponível.
const POLL_INTERVAL_MS = 8000;
const MAX_POLLS = 30;
const percentage = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

interface Filters { status: InvoiceStatus | ''; type: InvoiceType | ''; unitId: string; startDate: string; endDate: string }
const EMPTY_FILTERS: Filters = { status: '', type: '', unitId: '', startDate: '', endDate: '' };

function statusTone(status: InvoiceStatus) {
    if (status === 'PAID') return 'ok';
    if (status === 'PENDING') return 'warn';
    if (status === 'OVERDUE') return 'err';
    if (status === 'REFUNDED' || status === 'CHARGED_BACK' || status === 'PARTIALLY_REFUNDED') return 'purple';
    return 'neutral';
}

function issuanceTone(state: string) {
    if (state === 'ACTIVE') return 'ok';
    if (state === 'QUEUED' || state === 'RETRY' || state === 'ISSUING') return 'warn';
    if (state === 'REVIEW') return 'err';
    return 'neutral';
}

function SummaryCard({ label, amount, caption, color }: { label: string; amount: string; caption: string; color: string }) {
    return (
        <div className="luxe-card" style={{ padding: 20 }}>
            <div className="tracking-luxe" style={{ fontSize: 9, color: 'var(--color-bone-muted)' }}>{label}</div>
            <div className="serif" style={{ fontSize: 26, color, marginTop: 8 }}>{amount}</div>
            <div style={{ fontSize: 12, color: 'var(--color-bone-dim)', marginTop: 4 }}>{caption}</div>
        </div>
    );
}

const count = (value: number) => `${value} ${value === 1 ? 'cobrança' : 'cobranças'}`;

export default function InvoicesList() {
    const { user } = useAuth();
    const canManage = user?.role === 'ADMIN' || user?.role === 'FUNCIONARIO';
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
    const [page, setPage] = useState(1);
    const [result, setResult] = useState<InvoicePage | null>(null);
    const [units, setUnits] = useState<Unit[]>([]);
    const [summary, setSummary] = useState<ChargesReport | null>(null);
    const [summaryError, setSummaryError] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    const [modal, setModal] = useState<'single' | 'batch' | null>(null);

    const filtered = Object.values(filters).some(Boolean);
    const rangeError = filters.startDate && filters.endDate && filters.startDate > filters.endDate
        ? 'O vencimento inicial deve ser anterior ou igual ao final.' : '';
    // O resumo segue o período filtrado; sem filtro, cobre os últimos 12 meses e os próximos 6 (inclui o que ainda vai vencer).
    const period = useMemo(() => {
        const today = todayBR();
        return {
            startDate: filters.startDate || monthStartShifted(today, -11),
            endDate: filters.endDate || monthEndShifted(today, 6),
        };
    }, [filters.startDate, filters.endDate]);

    const query = useMemo<InvoiceFilters>(() => ({
        status: filters.status || undefined, type: filters.type || undefined, unitId: filters.unitId || undefined,
        startDate: filters.startDate || undefined, endDate: filters.endDate || undefined, page, limit: PAGE_SIZE,
    }), [filters, page]);
    const inFlight = result?.data.some(invoice => ISSUANCE_IN_FLIGHT.has(invoice.issuanceStatus)) ?? false;

    function changeFilters(patch: Partial<Filters>) {
        setFilters(current => ({ ...current, ...patch }));
        setPage(1);
    }

    useEffect(() => {
        if (!canManage) return;
        let cancelled = false;
        unitService.getAll().then(data => { if (!cancelled) setUnits(data); }).catch(() => undefined);
        return () => { cancelled = true; };
    }, [canManage]);

    useEffect(() => {
        if (!canManage || rangeError) return;
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError('');
            try {
                const data = await invoiceService.listAll(query);
                if (!cancelled) setResult(data);
            } catch (err) {
                if (!cancelled) setError(apiErrorMessage(err, 'Erro ao carregar cobranças.'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        void load();
        return () => { cancelled = true; };
    }, [canManage, rangeError, query, revision]);

    // Atualização silenciosa (sem trocar a tabela por "Carregando") enquanto algum Pix ainda está sendo gerado.
    useEffect(() => {
        if (!canManage || rangeError || !inFlight) return;
        let cancelled = false;
        let polls = 0;
        const timer = window.setInterval(async () => {
            if (document.hidden) return;
            if (++polls > MAX_POLLS) { window.clearInterval(timer); return; }
            try {
                const data = await invoiceService.listAll(query);
                if (!cancelled) setResult(data);
            } catch { /* a próxima rodada tenta de novo */ }
        }, POLL_INTERVAL_MS);
        return () => { cancelled = true; window.clearInterval(timer); };
    }, [canManage, rangeError, inFlight, query, revision]);

    useEffect(() => {
        if (!canManage || rangeError) return;
        let cancelled = false;
        async function load() {
            setSummaryError('');
            try {
                const data = await reportService.charges(period);
                if (!cancelled) setSummary(data);
            } catch (err) {
                if (!cancelled) { setSummary(null); setSummaryError(apiErrorMessage(err, 'Resumo indisponível.')); }
            }
        }
        void load();
        return () => { cancelled = true; };
    }, [canManage, rangeError, period, revision]);

    if (!canManage) {
        return <div><Header title="Cobranças" /><PageBody><p role="alert">Acesso restrito à administração e aos funcionários.</p></PageBody></div>;
    }

    const now = new Date();
    const totals = summary?.summary;
    return (
        <div>
            <Header title="Cobranças" eyebrow="Financeiro" />
            <PageBody>
                <SectionHeader title="Cobranças" eyebrow="Financeiro"
                    subtitle="Emita e acompanhe as cobranças Pix dos moradores, com valores, vencimentos e situação."
                    action={
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <button className="btn-ghost" onClick={() => setRevision(value => value + 1)} disabled={loading}>
                                <RefreshCw size={14} /> Atualizar
                            </button>
                            <button className="btn-ghost" onClick={() => setModal('batch')}><Users size={14} /> Emitir em lote</button>
                            <button className="btn-gold" onClick={() => setModal('single')}><Plus size={14} /> Nova cobrança</button>
                        </div>
                    } />

                {summaryError && !rangeError && <p role="alert" style={{ color: 'var(--color-err)', marginBottom: 12 }}>{summaryError}</p>}
                {totals && !rangeError && <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 12 }}>
                        <SummaryCard label="Recebido" amount={formatMoneyBR(totals.paid.amount)} caption={count(totals.paid.count)} color="var(--color-ok)" />
                        <SummaryCard label="A vencer" amount={formatMoneyBR(totals.pending.amount)} caption={count(totals.pending.count)} color="var(--color-warn)" />
                        <SummaryCard label="Vencido" amount={formatMoneyBR(totals.overdue.amount)} caption={count(totals.overdue.count)} color="var(--color-err)" />
                        <SummaryCard label="Inadimplência" amount={`${percentage.format(totals.delinquencyRate)}%`} caption="do valor total do período" color="var(--color-bone)" />
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--color-bone-muted)', marginBottom: 28 }}>
                        Vencimentos de {formatDueDateBR(period.startDate)} a {formatDueDateBR(period.endDate)}. O resumo soma cobranças pagas, a vencer e vencidas; canceladas e estornadas ficam de fora.
                    </p>
                </>}

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                    <label>Status<FilterSelect value={filters.status} onChange={value => changeFilters({ status: value as InvoiceStatus | '' })}
                        placeholder="Todos os status" options={Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => ({ value, label }))} /></label>
                    <label>Tipo<FilterSelect value={filters.type} onChange={value => changeFilters({ type: value as InvoiceType | '' })}
                        placeholder="Todos os tipos" options={Object.entries(INVOICE_TYPE_LABELS).map(([value, label]) => ({ value, label }))} /></label>
                    <label>Unidade<FilterSelect value={filters.unitId} onChange={value => changeFilters({ unitId: value })}
                        placeholder="Todas as unidades" options={units.map(unit => ({ value: unit.id, label: formatUnitDisplay(unit) }))} /></label>
                    <label>Vencimento de<input className="luxe-input" type="date" max="9998-12-31" value={filters.startDate}
                        onChange={event => changeFilters({ startDate: event.target.value })} /></label>
                    <label>até<input className="luxe-input" type="date" max="9998-12-31" value={filters.endDate}
                        onChange={event => changeFilters({ endDate: event.target.value })} /></label>
                    {filtered && <button className="btn-ghost" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }}>Limpar filtros</button>}
                </div>

                {result && !rangeError && <ListMeta count={result.meta.total} singular="cobrança" plural="cobranças" />}
                {inFlight && !rangeError && (
                    <p role="status" style={{ fontSize: 12, color: 'var(--color-bone-muted)', marginBottom: 12 }}>
                        Há Pix sendo gerados. A lista se atualiza sozinha.
                    </p>
                )}
                {rangeError ? <p role="alert" style={{ color: 'var(--color-err)' }}>{rangeError}</p>
                    : error ? <div role="alert" className="luxe-card" style={{ padding: 24, color: 'var(--color-err)' }}>
                        <p>{error}</p><button className="btn-ghost" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button>
                    </div> : loading ? <p role="status"><Loader2 size={18} className="animate-spin" /> Carregando cobranças...</p>
                        : !result || result.data.length === 0 ? <div className="luxe-card"><EmptyTable title="Nenhuma cobrança encontrada"
                            hint={filtered ? 'Confira os filtros selecionados.' : 'As cobranças emitidas aparecerão aqui.'} /></div>
                            : <div className="luxe-card" style={{ overflowX: 'auto' }}>
                                <table className="luxe-table">
                                    <thead><tr><th>Descrição</th><th>Morador</th><th>Unidade</th><th>Vencimento</th><th style={{ textAlign: 'right' }}>Valor</th><th>Status</th><th>Pix</th></tr></thead>
                                    <tbody>{result.data.map(invoice => {
                                        const status = effectiveInvoiceStatus(invoice, now);
                                        return <tr key={invoice.id}>
                                            <td style={{ overflowWrap: 'anywhere', maxWidth: 280 }}>
                                                {invoice.description}
                                                <div style={{ fontSize: 11, color: 'var(--color-bone-muted)' }}>{INVOICE_TYPE_LABELS[invoice.type] ?? invoice.type}</div>
                                            </td>
                                            <td>{invoice.user?.name ?? '—'}</td>
                                            <td>{formatUnitDisplay(invoice.unit)}</td>
                                            <td>{formatDueDateBR(invoice.dueDate)}</td>
                                            <td style={{ textAlign: 'right' }}>{formatMoneyBR(invoice.amount)}</td>
                                            <td><Tag tone={statusTone(status)}>{INVOICE_STATUS_LABELS[status]}</Tag></td>
                                            <td><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                <Tag tone={issuanceTone(invoice.issuanceStatus)}>
                                                    {ISSUANCE_LABELS[invoice.issuanceStatus] ?? INVOICE_STATUS_LABELS[invoice.issuanceStatus as InvoiceStatus] ?? invoice.issuanceStatus}
                                                </Tag>
                                                {invoice.requiresReview && <Tag tone="err">Revisar</Tag>}
                                                {invoice.paymentEnvironment === 'TEST' && <Tag tone="gold">Teste</Tag>}
                                            </div></td>
                                        </tr>;
                                    })}</tbody>
                                </table>
                            </div>}

                {result && result.meta.totalPages > 1 && !rangeError && !error && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                        <button className="btn-ghost" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>Anterior</button>
                        <span style={{ fontSize: 12, color: 'var(--color-bone-muted)' }}>Página {result.meta.page} de {result.meta.totalPages}</span>
                        <button className="btn-ghost" disabled={page >= result.meta.totalPages || loading} onClick={() => setPage(value => value + 1)}>Próxima</button>
                    </div>
                )}
            </PageBody>
            {modal === 'single' && <InvoiceFormModal onClose={() => setModal(null)} onCreated={() => setRevision(value => value + 1)} />}
            {modal === 'batch' && <InvoiceBatchModal onClose={() => setModal(null)} onCreated={() => setRevision(value => value + 1)} />}
        </div>
    );
}
