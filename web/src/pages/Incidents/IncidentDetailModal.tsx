import { useEffect, useState, type FormEvent } from 'react';
import { MessageSquare, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import LuxuryModal, { LuxuryModalFooter } from '../../components/luxury/LuxuryModal';
import { formatDateTimeBR } from '../../components/luxury/formatters';
import { useAuth } from '../../hooks/useAuth';
import { hasPanelAccess } from '../../lib/access';
import { apiErrorMessage } from '../../lib/apiError';
import { incidentService } from '../../services/incidentService';
import { INCIDENT_CATEGORY_LABELS, INCIDENT_STATUS_LABELS, type Incident, type IncidentStatus } from '../../types/incident';

interface Props {
    incidentId: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function IncidentDetailModal({ incidentId, onClose, onSuccess }: Props) {
    const { user } = useAuth();
    const [incident, setIncident] = useState<Incident | null>(null);
    const [status, setStatus] = useState<IncidentStatus>('OPEN');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const canUpdate = hasPanelAccess(user) && incident?.status !== 'CLOSED';

    useEffect(() => {
        let cancelled = false;
        incidentService.getById(incidentId).then(data => {
            if (cancelled) return;
            setIncident(data);
            setStatus(data.status);
            setResponse(data.response ?? '');
        }).catch(err => {
            if (!cancelled) setError(apiErrorMessage(err, 'Erro ao carregar ocorrência.'));
        }).finally(() => {
            if (!cancelled) setLoading(false);
        });
        return () => { cancelled = true; };
    }, [incidentId]);

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!incident || !canUpdate || busy) return;
        const data: { status?: IncidentStatus; response?: string } = {};
        if (status !== incident.status) data.status = status;
        if (response !== (incident.response ?? '')) data.response = response;
        if (!Object.keys(data).length) { setError('Altere o status ou a resposta para salvar.'); return; }
        setBusy(true);
        setError('');
        try {
            await incidentService.update(incident.id, data);
            toast.success('Ocorrência atualizada.');
            onSuccess();
        } catch (err) {
            setError(apiErrorMessage(err, 'Erro ao atualizar ocorrência.'));
        } finally {
            setBusy(false);
        }
    }

    return <LuxuryModal open onClose={onClose} busy={busy} icon={<MessageSquare size={18} />} title="Detalhe da ocorrência" size="lg">
        <div style={{ padding: 28, display: 'grid', gap: 18 }}>
            {error && <p role="alert" style={{ color: 'var(--color-err)' }}>{error}</p>}
            {loading && <p role="status"><Loader2 size={18} className="animate-spin" /> Carregando ocorrência...</p>}
            {incident && <>
                <h3 style={{ overflowWrap: 'anywhere' }}>{incident.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--color-bone-dim)' }}>
                    {INCIDENT_CATEGORY_LABELS[incident.category]} · {INCIDENT_STATUS_LABELS[incident.status]}<br />
                    {incident.author.name} · {incident.unit ? [incident.unit.block, incident.unit.number].filter(Boolean).join(' / ') : 'Sem unidade'}<br />
                    Registrada em {formatDateTimeBR(incident.createdAt)}
                </p>
                <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.6 }}>{incident.description}</p>
                {incident.respondedAt && <p style={{ fontSize: 12, color: 'var(--color-bone-dim)' }}>Respondida em {formatDateTimeBR(incident.respondedAt)}</p>}
                {canUpdate ? <form onSubmit={submit} style={{ display: 'grid', gap: 18 }}>
                    <label>Status
                        <select className="luxe-input" value={status} disabled={busy} onChange={event => setStatus(event.target.value as IncidentStatus)}>
                            {Object.entries(INCIDENT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                    </label>
                    <label>Resposta ao morador
                        <textarea className="luxe-input" maxLength={2000} rows={5} value={response} disabled={busy}
                            onChange={event => setResponse(event.target.value)} />
                    </label>
                    {status === 'CLOSED' && <p style={{ color: 'var(--color-warn)' }}>Após encerrar, esta ocorrência não poderá mais ser alterada.</p>}
                    <LuxuryModalFooter onCancel={onClose} submitLabel="Salvar" loadingLabel="Salvando..." isSubmitting={busy} />
                </form> : <>
                    <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{incident.response || 'Sem resposta registrada.'}</p>
                    {incident.status === 'CLOSED' && <p>Ocorrência encerrada. Não é possível alterar o status ou a resposta.</p>}
                </>}
            </>}
        </div>
    </LuxuryModal>;
}
