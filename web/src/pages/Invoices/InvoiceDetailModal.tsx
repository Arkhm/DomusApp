import { useEffect, useState } from 'react';
import { Receipt } from 'lucide-react';
import LuxuryModal from '../../components/luxury/LuxuryModal';
import Tag from '../../components/luxury/Tag';
import { loadErrorMessage } from '../../lib/invoiceActions';
import { issuanceLabel, issuanceTone, statusTone } from '../../lib/invoiceDisplay';
import { paymentSourceLabel } from '../../lib/invoiceAudit';
import { formatDateTimeBR, formatDueDateBR, formatMoneyBR, formatReferenceMonthBR } from '../../lib/invoiceFormat';
import { invoiceService } from '../../services/invoiceService';
import {
    INVOICE_STATUS_LABELS, INVOICE_TYPE_LABELS, ISSUANCE_IN_FLIGHT, effectiveInvoiceStatus, type Invoice, type InvoiceAudit,
} from '../../types/invoice';
import { formatUnitDisplay } from '../../types/user';
import { TestEnvironmentNotice } from './EmissionNotes';
import InvoiceActionPanel from './InvoiceActionPanel';
import InvoiceAuditTimeline from './InvoiceAuditTimeline';
import InvoicePixPanel from './InvoicePixPanel';
import { useActorNames } from './useActorNames';

// Enquanto o Pix está sendo gerado, o detalhe se atualiza a cada 5 s, por no máximo 24 vezes (2 minutos).
const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 24;

interface Props {
    /** A linha da lista: aparece de imediato enquanto os dados atuais são buscados. */
    invoice: Invoice;
    onClose: () => void;
    /** Algo mudou (ou pode ter mudado): a lista deve recarregar. */
    onChanged: () => void;
}

const sectionTitle = { fontSize: 11, margin: '0 0 12px', color: 'var(--color-bone-muted)' } as const;

/** Detalhe de uma cobrança: dados, Pix ativo, ações da administração e histórico de alterações. */
export default function InvoiceDetailModal({ invoice: initial, onClose, onChanged }: Props) {
    const [invoice, setInvoice] = useState<Invoice>(initial);
    const [audit, setAudit] = useState<InvoiceAudit[] | null>(null);
    const [detailError, setDetailError] = useState('');
    const [auditError, setAuditError] = useState('');
    const [notice, setNotice] = useState('');
    const [acting, setActing] = useState(false);
    // Cada alteração ou nova tentativa incrementa o contador, o que refaz a busca da cobrança e do histórico.
    const [attempt, setAttempt] = useState(0);
    const names = useActorNames();
    const refresh = () => setAttempt(value => value + 1);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            const [detail, history] = await Promise.allSettled([invoiceService.getById(initial.id), invoiceService.audit(initial.id)]);
            if (cancelled) return;
            if (detail.status === 'fulfilled') { setInvoice(detail.value); setDetailError(''); }
            else setDetailError(loadErrorMessage(detail.reason, 'Não foi possível atualizar os dados da cobrança.'));
            if (history.status === 'fulfilled') { setAudit(history.value); setAuditError(''); }
            else setAuditError(loadErrorMessage(history.reason, 'Não foi possível carregar o histórico.'));
        }
        void load();
        return () => { cancelled = true; };
    }, [initial.id, attempt]);

    const inFlight = ISSUANCE_IN_FLIGHT.has(invoice.issuanceStatus);
    useEffect(() => {
        if (!inFlight) return;
        let polls = 0;
        const timer = window.setInterval(() => {
            if (document.hidden) return;
            if (++polls > MAX_POLLS) { window.clearInterval(timer); return; }
            setAttempt(value => value + 1);
        }, POLL_INTERVAL_MS);
        return () => window.clearInterval(timer);
    }, [inFlight]);

    function applied(updated: Invoice, message: string) {
        setInvoice(updated);
        setNotice(message);
        refresh();
        onChanged();
    }

    function failed() {
        setNotice('');
        refresh();
        onChanged();
    }

    const status = effectiveInvoiceStatus(invoice, new Date());
    const rows: [string, React.ReactNode][] = [
        ['Descrição', <span style={{ overflowWrap: 'anywhere' }}>{invoice.description}</span>],
        ['Tipo', INVOICE_TYPE_LABELS[invoice.type] ?? invoice.type],
        ['Morador', invoice.user ? `${invoice.user.name} (${invoice.user.email})` : '—'],
        ['Unidade', formatUnitDisplay(invoice.unit)],
        ['Valor', formatMoneyBR(invoice.amount)],
        ['Vencimento', formatDueDateBR(invoice.dueDate)],
        ['Mês de referência', formatReferenceMonthBR(invoice.referenceMonth)],
        ['Situação', <Tag tone={statusTone(status)}>{INVOICE_STATUS_LABELS[status]}</Tag>],
        ['Pix', <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
            <Tag tone={issuanceTone(invoice.issuanceStatus)}>{issuanceLabel(invoice)}</Tag>
            {invoice.requiresReview && <Tag tone="err">Revisar</Tag>}
            {invoice.paymentEnvironment === 'TEST' && <Tag tone="gold">Teste</Tag>}
        </span>],
    ];
    if (invoice.paymentData.mpOrderId) rows.push(['Pedido no Mercado Pago', <span style={{ overflowWrap: 'anywhere', fontSize: 13 }}>{invoice.paymentData.mpOrderId}</span>]);
    if (invoice.paidAt) rows.push(['Paga em', `${formatDateTimeBR(invoice.paidAt)} · ${paymentSourceLabel(invoice.paymentSource)}`]);
    rows.push(['Criada em', formatDateTimeBR(invoice.createdAt)]);

    return (
        <LuxuryModal open onClose={onClose} busy={acting} icon={<Receipt size={18} />} title="Detalhes da cobrança"
            subtitle={`${invoice.user?.name ?? '—'} · ${formatUnitDisplay(invoice.unit)}`} size="xl">
            <div style={{ padding: 28, display: 'grid', gap: 28 }}>
                {notice && <p role="status" style={{ margin: 0, color: 'var(--color-ok)' }}>{notice}</p>}
                {detailError && <p role="alert" style={{ margin: 0, color: 'var(--color-err)' }}>{detailError}{' '}
                    <button type="button" className="btn-ghost" onClick={refresh}>Tentar novamente</button></p>}

                <section aria-label="Dados da cobrança">
                    <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 18px', margin: 0, alignItems: 'baseline' }}>
                        {rows.map(([label, value]) => <div key={label} style={{ display: 'contents' }}>
                            <dt style={{ fontSize: 12, color: 'var(--color-bone-muted)' }}>{label}</dt>
                            <dd style={{ margin: 0, minWidth: 0 }}>{value}</dd>
                        </div>)}
                    </dl>
                    {inFlight && <p role="status" style={{ fontSize: 12, color: 'var(--color-bone-muted)', margin: '12px 0 0' }}>O Pix está sendo gerado. Esta tela se atualiza sozinha.</p>}
                </section>

                <TestEnvironmentNotice invoices={[invoice]} extra="Um pagamento feito no teste não altera a situação da cobrança." />

                {invoice.requiresReview && (
                    <p role="note" style={{ margin: 0, fontSize: 13, color: 'var(--color-err)' }}>
                        Esta cobrança precisa de revisão. Use “Conciliar com o Mercado Pago” para conferir o pedido antes de qualquer alteração manual.
                    </p>
                )}

                {(invoice.paymentData.qrCode || invoice.paymentData.qrCodeBase64 || invoice.paymentData.ticketUrl) && (
                    <section aria-label="Pix da cobrança">
                        <h3 className="tracking-luxe" style={sectionTitle}>PIX</h3>
                        <InvoicePixPanel invoice={invoice} />
                    </section>
                )}

                <section aria-label="Ações">
                    <h3 className="tracking-luxe" style={sectionTitle}>AÇÕES</h3>
                    <InvoiceActionPanel invoice={invoice} onApplied={applied} onFailed={failed} onBusyChange={setActing} />
                </section>

                <section aria-label="Histórico">
                    <h3 className="tracking-luxe" style={sectionTitle}>HISTÓRICO</h3>
                    <InvoiceAuditTimeline entries={audit} error={auditError} names={names} onRetry={refresh} />
                </section>

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--color-line)' }}>
                    <button type="button" className="btn-gold" onClick={onClose} disabled={acting}>Fechar</button>
                </div>
            </div>
        </LuxuryModal>
    );
}
