import { useSearchParams } from 'react-router-dom';
import InvoiceDetailModal from './InvoiceDetailModal';
import PaymentHealth from './PaymentHealth';
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, RefreshCw, Users } from 'lucide-react';
import Header from '../../components/layout/Header';
import PageBody from '../../components/luxury/PageBody';
import SectionHeader from '../../components/luxury/SectionHeader';
import Tag from '../../components/luxury/Tag';
import { EmptyTable, FilterSelect, ListMeta } from '../../components/luxury/ListHelpers';
import { useAuth } from '../../hooks/useAuth';
import { apiErrorMessage } from '../../lib/apiError';
import { issuanceLabel, issuanceTone, statusTone } from '../../lib/invoiceDisplay';
import { formatDueDateBR, formatMoneyBR, todayBR } from '../../lib/invoiceFormat';
import { summaryPeriod, summaryPeriodIssue, type SummaryPeriod } from '../../lib/invoicePeriod';
import { EMPTY_FILTERS, buildInvoiceQuery, filterRangeError, type InvoiceFilterState } from '../../lib/invoiceQuery';
import { invoiceService } from '../../services/invoiceService';
import { reportService } from '../../services/reportService';
import api from '../../services/api';
import {
    INVOICE_STATUS_LABELS, INVOICE_TYPE_LABELS, ISSUANCE_IN_FLIGHT, effectiveInvoiceStatus,
    type InvoicePage, type InvoiceStatus, type InvoiceType,
} from '../../types/invoice';
import type { ChargesReport } from '../../types/report';
import { formatUnitDisplay, type Unit } from '../../types/user';
import InvoiceBatchModal from './InvoiceBatchModal';
import InvoiceFormModal from './InvoiceFormModal';

const PAGE_SIZE = 20;
const percentage = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
// Enquanto há Pix sendo gerado, a lista se atualiza sozinha a cada 8 s, por no máximo 30 vezes (4 minutos).
// Depois disso o botão "Atualizar" continua disponível.
const POLL_INTERVAL_MS = 8000;
const MAX_POLLS = 30;
const emptyPage = (page: number): InvoicePage => ({ data: [], meta: { total: 0, page, limit: PAGE_SIZE, totalPages: 0 } });

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
    const canManage = user?.role === 'ADMIN' || user?.role === 'FUNCIONARIO' || (user?.role === 'MORADOR' && user.isSyndic);
    const [filters, setFilters] = useState<InvoiceFilterState>(EMPTY_FILTERS);
    const [page, setPage] = useState(1);
    const [result, setResult] = useState<InvoicePage | null>(null);
    const [units, setUnits] = useState<Unit[]>([]);
    const [unitsError, setUnitsError] = useState('');
    const [unitsAttempt, setUnitsAttempt] = useState(0);
    // O resumo guarda o período a que se refere: a legenda mostra o que os totais cobrem, não o que está digitado.
    const [summary, setSummary] = useState<{ period: SummaryPeriod; report: ChargesReport } | null>(null);
    const [summaryError, setSummaryError] = useState('');
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedId = searchParams.get('invoice');
    const setSelectedId = (id: string | null) => setSearchParams(previous => {
        const next = new URLSearchParams(previous);
        if (id) next.set('invoice', id); else next.delete('invoice');
        return next;
    }, { replace: true });
    const [modal, setModal] = useState<'single' | 'batch' | null>(null);
    // Instante de referência das consultas. Recarregar renova este valor, o que refaz a lista e o resumo
    // (e atualiza a fronteira "agora" do filtro "Pendente").
    const [asOf, setAsOf] = useState(() => new Date());
    const reload = () => setAsOf(new Date());

    const filtered = Object.values(filters).some(Boolean);
    const rangeError = filterRangeError(filters);
    // O resumo segue o período filtrado; sem filtro, cobre os últimos 12 meses e os próximos 6 (inclui o que ainda vai vencer).
    const period = useMemo(() => summaryPeriod(filters, todayBR()), [filters]);
    const periodIssue = rangeError ? '' : summaryPeriodIssue(period);
    const query = useMemo(() => buildInvoiceQuery(filters, page, PAGE_SIZE, asOf), [filters, page, asOf]);

    const inFlight = result?.data.some(invoice => ISSUANCE_IN_FLIGHT.has(invoice.issuanceStatus)) ?? false;

    function changeFilters(patch: Partial<InvoiceFilterState>) {
        setFilters(current => ({ ...current, ...patch }));
        setPage(1);
    }

    useEffect(() => {
        if (!canManage) return;
        let cancelled = false;
        async function load() {
            setUnitsError('');
            try {
                const data = (await api.get<Unit[]>('/invoices/units')).data;
                if (!cancelled) setUnits(data);
            } catch {
                if (!cancelled) setUnitsError('Não foi possível carregar as unidades.');
            }
        }
        void load();
        return () => { cancelled = true; };
    }, [canManage, unitsAttempt]);

    useEffect(() => {
        if (!canManage || rangeError || query.kind === 'empty') return;
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError('');
            try {
                const data = await invoiceService.listAll(query.kind === 'query' ? query.params : {});
                if (!cancelled) setResult(data);
            } catch (err) {
                if (!cancelled) setError(apiErrorMessage(err, 'Erro ao carregar cobranças.'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        void load();
        return () => { cancelled = true; };
    }, [canManage, rangeError, query]);

    // Atualização silenciosa (sem trocar a tabela por "Carregando") enquanto algum Pix ainda está sendo gerado.
    useEffect(() => {
        if (!canManage || rangeError || !inFlight || query.kind !== 'query') return;
        const params = query.params;
        let cancelled = false;
        let polls = 0;
        const timer = window.setInterval(async () => {
            if (document.hidden) return;
            if (++polls > MAX_POLLS) { window.clearInterval(timer); return; }
            try {
                const data = await invoiceService.listAll(params);
                if (!cancelled) setResult(data);
            } catch { /* a próxima rodada tenta de novo */ }
        }, POLL_INTERVAL_MS);
        return () => { cancelled = true; window.clearInterval(timer); };
    }, [canManage, rangeError, inFlight, query]);

    useEffect(() => {
        if (!canManage || rangeError || periodIssue) return;
        let cancelled = false;
        async function load() {
            setSummaryError('');
            setSummaryLoading(true);
            try {
                const report = await reportService.charges(period);
                if (!cancelled) setSummary({ period, report });
            } catch (err) {
                if (!cancelled) { setSummary(null); setSummaryError(apiErrorMessage(err, 'Resumo indisponível.')); }
            } finally {
                if (!cancelled) setSummaryLoading(false);
            }
        }
        void load();
        return () => { cancelled = true; };
    }, [canManage, rangeError, periodIssue, period, asOf]);

    if (!canManage) {
        return <div><Header title="Cobranças" /><PageBody><p role="alert">Acesso restrito à gestão financeira.</p></PageBody></div>;
    }

    // Filtro sem resultado possível (ex.: "Pendente" com vencimento final no passado): vazio direto, sem consultar a API.
    const noPossibleResult = query.kind === 'empty';
    const shown = noPossibleResult ? emptyPage(page) : result;
    const shownLoading = noPossibleResult ? false : loading;
    const shownError = noPossibleResult ? '' : error;
    const now = new Date();
    const totals = summary?.report.summary;
    return (
        <div>
            <Header title="Cobranças" eyebrow="Financeiro" />
            <PageBody>
                <SectionHeader title="Cobranças" eyebrow="Financeiro"
                    subtitle="Emita e acompanhe as cobranças Pix dos moradores, com valores, vencimentos e situação."
                    action={
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <button className="btn-ghost" onClick={reload} disabled={loading}>
                                <RefreshCw size={14} /> Atualizar
                            </button>
                            <button className="btn-ghost" onClick={() => setModal('batch')}><Users size={14} /> Emitir em lote</button>
                            <button className="btn-gold" onClick={() => setModal('single')}><Plus size={14} /> Nova cobrança</button>
                        </div>
                    } />

                <PaymentHealth revision={asOf} />
                {summaryError && !rangeError && !periodIssue && <p role="alert" style={{ color: 'var(--color-err)', marginBottom: 12 }}>{summaryError}</p>}
                {periodIssue && <p role="note" style={{ fontSize: 13, color: 'var(--color-warn)', marginBottom: 28 }}>{periodIssue}</p>}
                {summary && totals && !rangeError && !periodIssue && <>
                    <div aria-busy={summaryLoading} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 12, opacity: summaryLoading ? 0.55 : 1, transition: 'opacity 0.15s' }}>
                        <SummaryCard label="Recebido" amount={formatMoneyBR(totals.paid.amount)} caption={count(totals.paid.count)} color="var(--color-ok)" />
                        <SummaryCard label="A vencer" amount={formatMoneyBR(totals.pending.amount)} caption={count(totals.pending.count)} color="var(--color-warn)" />
                        <SummaryCard label="Vencido" amount={formatMoneyBR(totals.overdue.amount)} caption={count(totals.overdue.count)} color="var(--color-err)" />
                        <SummaryCard label="Inadimplência" amount={`${percentage.format(totals.delinquencyRate)}%`} caption="do valor total do período" color="var(--color-bone)" />
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--color-bone-muted)', marginBottom: 28 }}>
                        Vencimentos de {formatDueDateBR(summary.period.startDate)} a {formatDueDateBR(summary.period.endDate)}. O resumo soma cobranças pagas, a vencer e vencidas; canceladas e estornadas ficam de fora.
                        {summaryLoading && ' Atualizando…'}
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
                {unitsError && (
                    <p role="alert" style={{ color: 'var(--color-err)', marginBottom: 16, fontSize: 13 }}>
                        {unitsError} O filtro por unidade está indisponível.{' '}
                        <button className="btn-ghost" onClick={() => setUnitsAttempt(value => value + 1)}>Tentar novamente</button>
                    </p>
                )}

                {shown && !rangeError && <ListMeta count={shown.meta.total} singular="cobrança" plural="cobranças" />}
                {inFlight && !rangeError && !noPossibleResult && (
                    <p role="status" style={{ fontSize: 12, color: 'var(--color-bone-muted)', marginBottom: 12 }}>
                        Há Pix sendo gerados. A lista se atualiza sozinha.
                    </p>
                )}
                {rangeError ? <p role="alert" style={{ color: 'var(--color-err)' }}>{rangeError}</p>
                    : shownError ? <div role="alert" className="luxe-card" style={{ padding: 24, color: 'var(--color-err)' }}>
                        <p>{shownError}</p><button className="btn-ghost" onClick={reload}>Tentar novamente</button>
                    </div> : shownLoading ? <p role="status"><Loader2 size={18} className="animate-spin" /> Carregando cobranças...</p>
                        : !shown || shown.data.length === 0 ? <div className="luxe-card"><EmptyTable title="Nenhuma cobrança encontrada"
                            hint={filtered ? 'Confira os filtros selecionados.' : 'As cobranças emitidas aparecerão aqui.'} /></div>
                            : <div className="luxe-card" style={{ overflowX: 'auto' }}>
                                <table className="luxe-table">
                                    <thead><tr><th>Descrição</th><th>Morador</th><th>Unidade</th><th>Vencimento</th><th style={{ textAlign: 'right' }}>Valor</th><th>Status</th><th>Pix</th><th>Ações</th></tr></thead>
                                    <tbody>{shown.data.map(invoice => {
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
                                                <Tag tone={issuanceTone(invoice.issuanceStatus)}>{issuanceLabel(invoice)}</Tag>
                                                {invoice.requiresReview && <Tag tone="err">Revisar</Tag>}
                                                {invoice.paymentEnvironment === 'TEST' && <Tag tone="gold">Teste</Tag>}
                                            </div></td><td><button className="btn-ghost" onClick={() => setSelectedId(invoice.id)}>Gerenciar</button></td>
                                        </tr>;
                                    })}</tbody>
                                </table>
                            </div>}

                {shown && shown.meta.totalPages > 1 && !rangeError && !shownError && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                        <button className="btn-ghost" disabled={page <= 1 || shownLoading} onClick={() => setPage(value => value - 1)}>Anterior</button>
                        <span style={{ fontSize: 12, color: 'var(--color-bone-muted)' }}>Página {shown.meta.page} de {shown.meta.totalPages}</span>
                        <button className="btn-ghost" disabled={page >= shown.meta.totalPages || shownLoading} onClick={() => setPage(value => value + 1)}>Próxima</button>
                    </div>
                )}
            </PageBody>
            {selectedId && <InvoiceDetailModal key={selectedId} id={selectedId} initialInvoice={result?.data.find(invoice => invoice.id === selectedId)} onClose={() => setSelectedId(null)} onChanged={reload} />}
            {modal === 'single' && <InvoiceFormModal onClose={() => setModal(null)} onCreated={reload} />}
            {modal === 'batch' && <InvoiceBatchModal onClose={() => setModal(null)} onCreated={reload} />}
        </div>
    );
}
