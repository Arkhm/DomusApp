import { useEffect, useState } from 'react';
import LuxuryModal from '../../components/luxury/LuxuryModal';
import { invoiceService } from '../../services/invoiceService';
import { apiErrorMessage } from '../../lib/apiError';
import { formatMoneyBR, formatDueDateBR } from '../../lib/invoiceFormat';
import type { Invoice } from '../../types/invoice';

type Detail = Invoice & { paymentExpiresAt?: string; paymentData?: { qrCode?: string; ticketUrl?: string } };
export default function InvoiceDetailModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
    const [data, setData] = useState<Detail | null>(null);
    const [audits, setAudits] = useState<Awaited<ReturnType<typeof invoiceService.audit>>>([]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [action, setAction] = useState('');
    const [reason, setReason] = useState('');
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        let active = true;
        Promise.all([invoiceService.detail(id), invoiceService.audit(id)]).then(([invoice, history]) => {
            if (active) { setData(invoice); setAudits(history); setError(''); }
        }).catch(err => { if (active) setError(apiErrorMessage(err, 'Não foi possível carregar a cobrança.')); });
        return () => { active = false; };
    }, [id, revision]);
    async function submit() {
        if (busy || !reason.trim() || !action) return;
        setBusy(true); setError('');
        try { await invoiceService.action(id, action, reason.trim()); setAction(''); setReason(''); onChanged(); }
        catch (err) { setError(apiErrorMessage(err, 'Operação não concluída.')); }
        finally { setRevision(value => value + 1); setBusy(false); }
    }
    const actions = data ? [
        ...(!data.requiresReview && ['PENDING', 'OVERDUE'].includes(data.status) ? [['paid', 'Registrar pagamento manual'], ['cancel', 'Cancelar cobrança']] : []),
        ['reconcile', 'Conciliar com o provedor'],
        ...(['RETRY', 'REVIEW'].includes(data.issuanceStatus) ? [['retry', 'Recuperar emissão']] : []),
    ] : [];
    return <LuxuryModal icon={null} open onClose={onClose} busy={busy} title="Gerenciar cobrança" size="lg">
        <div style={{ padding: 28, display: 'grid', gap: 16 }}>
            {error && <p role="alert">{error}</p>}
            {!data ? <button onClick={() => setRevision(value => value + 1)}>Carregar novamente</button> : <>
                <h2>{data.description}</h2><p>{data.user?.name} · {formatMoneyBR(data.amount)} · {formatDueDateBR(data.dueDate)}</p>
                <p>Situação: {data.status} · Emissão: {data.issuanceStatus} · Ambiente: {data.paymentEnvironment ?? 'Legado'}</p>
                {data.requiresReview && <p role="alert">Esta cobrança exige conferência. Concilie antes de realizar outra operação.</p>}
                {data.paymentData?.qrCode && <details><summary>Código Pix</summary><p style={{ overflowWrap: 'anywhere' }}>{data.paymentData.qrCode}</p></details>}
                {!action ? actions.map(([value, label]) => <button className="btn-ghost" key={value} onClick={() => setAction(value)}>{label}</button>) : <>
                    <p>Confirmar: {actions.find(([value]) => value === action)?.[1]}. A situação será verificada novamente no servidor.</p>
                    <label>Justificativa<textarea className="luxe-input" maxLength={191} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></label>
                    <button className="btn-gold" disabled={busy || !reason.trim()} onClick={() => void submit()}>Confirmar operação</button>
                    <button disabled={busy} onClick={() => setAction('')}>Voltar</button>
                </>}
                <h3>Auditoria</h3>{audits.length === 0 ? <p>Nenhum registro.</p> : audits.map(a => <p key={a.id}>{new Date(a.createdAt).toLocaleString('pt-BR')} · {a.action} {a.reason && `· ${a.reason}`}</p>)}
            </>}
        </div>
    </LuxuryModal>;
}
