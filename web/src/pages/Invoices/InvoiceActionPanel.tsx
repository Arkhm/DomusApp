import { useState, type FormEvent } from 'react';
import {
    ACTION_CONFIRM_LABELS, ACTION_EXPLANATIONS, ACTION_LABELS, ACTION_SUCCESS, IRREVERSIBLE, REASON_MAX,
    actionErrorMessage, availableActions, validateReason, type ActionKind,
} from '../../lib/invoiceActions';
import { formatMoneyBR } from '../../lib/invoiceFormat';
import { runInvoiceAction } from '../../lib/runInvoiceAction';
import type { Invoice } from '../../types/invoice';

const ORDER: ActionKind[] = ['reconcile', 'retry', 'markPaid', 'cancel'];

interface Props {
    invoice: Invoice;
    /** A ação foi aplicada: recebe a cobrança atualizada e a mensagem de sucesso. */
    onApplied: (invoice: Invoice, message: string) => void;
    /** A ação falhou: o estado real da cobrança pode ter mudado, então quem chamou deve recarregar os dados. */
    onFailed: () => void;
    /** Avisa quando há uma ação em andamento, para o modal não ser fechado no meio. */
    onBusyChange: (busy: boolean) => void;
}

/**
 * Ações da administração sobre a cobrança. Cada uma pede uma justificativa (ela fica no histórico) e mostra o que vai
 * acontecer antes de confirmar. As indisponíveis aparecem desabilitadas com o motivo, em vez de sumirem.
 */
export default function InvoiceActionPanel({ invoice, onApplied, onFailed, onBusyChange }: Props) {
    const actions = availableActions(invoice);
    const [selected, setSelected] = useState<ActionKind | null>(null);
    const [reason, setReason] = useState('');
    const [reasonError, setReasonError] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    // Se a cobrança mudou e a ação escolhida deixou de valer, o formulário se fecha sozinho.
    const active = selected && actions[selected].allowed ? selected : null;

    function choose(kind: ActionKind) {
        if (busy) return;
        setSelected(kind);
        setReason('');
        setReasonError('');
        setError('');
    }

    async function confirm(event: FormEvent) {
        event.preventDefault();
        if (!active || busy) return;
        const checked = validateReason(reason);
        if (checked.error !== undefined) { setReasonError(checked.error); return; }
        setBusy(true);
        onBusyChange(true);
        setError('');
        try {
            const updated = await runInvoiceAction(active, invoice.id, checked.value);
            setSelected(null);
            setReason('');
            onApplied(updated, ACTION_SUCCESS[active]);
        } catch (err) {
            setError(actionErrorMessage(err));
            onFailed();
        } finally {
            setBusy(false);
            onBusyChange(false);
        }
    }

    return (
        <div style={{ display: 'grid', gap: 12 }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
                {ORDER.map(kind => (
                    <li key={kind} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button type="button" className="btn-ghost" disabled={busy || !actions[kind].allowed} aria-pressed={active === kind}
                            onClick={() => choose(kind)} style={{ minWidth: 240, justifyContent: 'flex-start' }}>
                            {ACTION_LABELS[kind]}
                        </button>
                        {!actions[kind].allowed && <span style={{ flex: '1 1 220px', fontSize: 12, color: 'var(--color-bone-muted)' }}>{actions[kind].hint}</span>}
                    </li>
                ))}
            </ul>

            {error && <p role="alert" style={{ color: 'var(--color-err)', margin: 0 }}>{error}</p>}

            {active && (
                <form onSubmit={confirm} noValidate aria-label={ACTION_LABELS[active]} className="luxe-card" style={{ padding: 16, display: 'grid', gap: 12 }}>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{ACTION_EXPLANATIONS[active]}</p>
                    {IRREVERSIBLE.has(active) && (
                        <p style={{ margin: 0, fontSize: 13, overflowWrap: 'anywhere' }}>
                            Cobrança: <strong>{invoice.description}</strong> · {formatMoneyBR(invoice.amount)}{invoice.user && ` · ${invoice.user.name}`}
                        </p>
                    )}
                    <label style={{ fontSize: 13, display: 'grid', gap: 6 }}>Motivo (fica registrado no histórico)
                        <textarea autoFocus className="luxe-input" rows={3} maxLength={REASON_MAX} value={reason} disabled={busy}
                            aria-invalid={!!reasonError} aria-describedby="invoice-action-reason-hint"
                            onChange={event => { setReason(event.target.value); setReasonError(''); }} />
                    </label>
                    <div id="invoice-action-reason-hint" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
                        <span role={reasonError ? 'alert' : undefined} style={{ color: 'var(--color-err)' }}>{reasonError}</span>
                        <span style={{ color: 'var(--color-bone-muted)' }}>{reason.length}/{REASON_MAX}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 12, borderTop: '1px solid var(--color-line)' }}>
                        <button type="button" className="btn-ghost" disabled={busy} onClick={() => setSelected(null)}>Voltar</button>
                        <button type="submit" className="btn-gold" disabled={busy}>{busy ? 'Aplicando...' : ACTION_CONFIRM_LABELS[active]}</button>
                    </div>
                </form>
            )}
        </div>
    );
}
