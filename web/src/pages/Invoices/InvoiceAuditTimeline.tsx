import { auditActionLabel, auditActor, auditSourceLabel, auditTransition } from '../../lib/invoiceAudit';
import { formatDateTimeBR, formatMoneyBR } from '../../lib/invoiceFormat';
import type { InvoiceAudit } from '../../types/invoice';

/** Limite de registros que a API devolve; ao chegar nele, o histórico pode ter registros mais antigos. */
const AUDIT_LIMIT = 100;

interface Props {
    entries: InvoiceAudit[] | null;
    error: string;
    names: Record<string, string> | null;
    onRetry: () => void;
}

/** Histórico da cobrança, do registro mais novo para o mais antigo: o que mudou, quem fez, quando e por quê. */
export default function InvoiceAuditTimeline({ entries, error, names, onRetry }: Props) {
    if (error && !entries) {
        return (
            <div role="alert" style={{ color: 'var(--color-err)' }}>
                <p>{error}</p>
                <button type="button" className="btn-ghost" onClick={onRetry}>Tentar novamente</button>
            </div>
        );
    }
    if (!entries) return <p role="status">Carregando histórico...</p>;
    if (entries.length === 0) return <p style={{ color: 'var(--color-bone-muted)' }}>Nenhum registro no histórico.</p>;

    return (
        <div>
            {error && <p role="alert" style={{ color: 'var(--color-err)', fontSize: 13 }}>{error} Os registros abaixo podem estar desatualizados.</p>}
            <ol aria-label="Histórico da cobrança" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {entries.map(entry => {
                    const change = auditTransition(entry);
                    const source = auditSourceLabel(entry.source);
                    // Com nomes carregados mostra quem fez; sem eles (ou em registro automático) fica só a origem.
                    const who = entry.actorId && names ? `${auditActor(entry, names)} · ${source}` : source;
                    return (
                        <li key={entry.id} style={{ padding: '12px 0', borderTop: '1px solid var(--color-line)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                <strong>{auditActionLabel(entry.action)}</strong>
                                <time dateTime={entry.createdAt} style={{ fontSize: 12, color: 'var(--color-bone-muted)' }}>{formatDateTimeBR(entry.createdAt)}</time>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--color-bone-muted)', marginTop: 2 }}>{who}</div>
                            {(change || entry.amount) && (
                                <div style={{ fontSize: 13, marginTop: 4 }}>
                                    {change}{change && entry.amount && ' · '}{entry.amount && `Valor ${formatMoneyBR(entry.amount)}`}
                                </div>
                            )}
                            {entry.reason && <p style={{ margin: '6px 0 0', fontSize: 13, overflowWrap: 'anywhere' }}>Motivo: {entry.reason}</p>}
                        </li>
                    );
                })}
            </ol>
            {entries.length >= AUDIT_LIMIT && (
                <p style={{ fontSize: 12, color: 'var(--color-bone-muted)', marginTop: 8 }}>Mostrando os {AUDIT_LIMIT} registros mais recentes.</p>
            )}
        </div>
    );
}
