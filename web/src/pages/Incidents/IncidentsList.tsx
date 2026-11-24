import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Header from '../../components/layout/Header';
import PageBody from '../../components/luxury/PageBody';
import SectionHeader from '../../components/luxury/SectionHeader';
import Tag from '../../components/luxury/Tag';
import { EmptyTable, FilterSelect, ListMeta } from '../../components/luxury/ListHelpers';
import { formatDateBR } from '../../components/luxury/formatters';
import { apiErrorMessage } from '../../lib/apiError';
import { incidentService } from '../../services/incidentService';
import { INCIDENT_CATEGORY_LABELS, INCIDENT_STATUS_LABELS, type Incident, type IncidentCategory, type IncidentStatus } from '../../types/incident';
import IncidentDetailModal from './IncidentDetailModal';

export default function IncidentsList() {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [status, setStatus] = useState<IncidentStatus | ''>('');
    const [category, setCategory] = useState<IncidentCategory | ''>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError('');
            try {
                const data = await incidentService.getAll({ status: status || undefined, category: category || undefined });
                if (!cancelled) setIncidents(data);
            } catch (err) {
                if (!cancelled) setError(apiErrorMessage(err, 'Erro ao carregar ocorrências.'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        void load();
        return () => { cancelled = true; };
    }, [status, category, revision]);

    return (
        <div>
            <Header title="Ocorrências" eyebrow="Atendimento aos moradores" />
            <PageBody>
                <SectionHeader title="Ocorrências" eyebrow="Vida em comunidade" subtitle="Acompanhe os relatos dos moradores e registre as respostas da gestão." />
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                    <label>Status<FilterSelect value={status} onChange={value => setStatus(value as IncidentStatus | '')}
                        placeholder="Todos os status" options={Object.entries(INCIDENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))} /></label>
                    <label>Categoria<FilterSelect value={category} onChange={value => setCategory(value as IncidentCategory | '')}
                        placeholder="Todas as categorias" options={Object.entries(INCIDENT_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} /></label>
                    {(status || category) && <button className="btn-ghost" onClick={() => { setStatus(''); setCategory(''); }}>Limpar filtros</button>}
                </div>
                <ListMeta count={incidents.length} singular="ocorrência" plural="ocorrências" />
                {error ? <div role="alert" className="luxe-card" style={{ padding: 24, color: 'var(--color-err)' }}>
                    <p>{error}</p><button className="btn-ghost" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button>
                </div> : loading ? <p role="status"><Loader2 size={18} className="animate-spin" /> Carregando ocorrências...</p>
                    : incidents.length === 0 ? <div className="luxe-card"><EmptyTable title="Nenhuma ocorrência encontrada" hint="Confira os filtros selecionados." /></div>
                    : <div className="luxe-card" style={{ overflowX: 'auto' }}>
                        <table className="luxe-table">
                            <thead><tr><th>Título</th><th>Categoria</th><th>Status</th><th>Unidade</th><th>Data</th><th>Detalhe</th></tr></thead>
                            <tbody>{incidents.map(incident => <tr key={incident.id}>
                                <td style={{ overflowWrap: 'anywhere' }}>{incident.title}</td>
                                <td>{INCIDENT_CATEGORY_LABELS[incident.category]}</td>
                                <td><Tag tone={incident.status === 'OPEN' ? 'warn' : incident.status === 'RESOLVED' ? 'ok' : 'neutral'}>{INCIDENT_STATUS_LABELS[incident.status]}</Tag></td>
                                <td>{incident.unit ? [incident.unit.block, incident.unit.number].filter(Boolean).join(' / ') : 'Sem unidade'}</td>
                                <td>{formatDateBR(incident.createdAt)}</td>
                                <td><button className="btn-ghost" onClick={() => setSelectedId(incident.id)}>Ver detalhe</button></td>
                            </tr>)}</tbody>
                        </table>
                    </div>}
            </PageBody>
            {selectedId && <IncidentDetailModal key={selectedId} incidentId={selectedId} onClose={() => setSelectedId(null)}
                onSuccess={() => { setSelectedId(null); setRevision(value => value + 1); }} />}
        </div>
    );
}
