import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import PageBody from '../../components/luxury/PageBody';
import SectionHeader from '../../components/luxury/SectionHeader';
import Tag from '../../components/luxury/Tag';
import { DeleteModal, EmptyTable, IconBtn, ListMeta } from '../../components/luxury/ListHelpers';
import { useAuth } from '../../hooks/useAuth';
import { apiErrorMessage } from '../../lib/apiError';
import { commonAreaService } from '../../services/commonAreaService';
import type { CommonArea } from '../../types/commonArea';
import CommonAreaFormModal from './CommonAreaFormModal';

export default function CommonAreasList() {
    const { user } = useAuth();
    const canManage = user?.role === 'ADMIN';
    const [areas, setAreas] = useState<CommonArea[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    const [editing, setEditing] = useState<CommonArea | null | undefined>(undefined);
    const [deleting, setDeleting] = useState<CommonArea | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError('');
            try {
                const data = await commonAreaService.getAll();
                if (!cancelled) setAreas(data);
            } catch (err) {
                if (!cancelled) setError(apiErrorMessage(err, 'Erro ao carregar áreas comuns.'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        void load();
        return () => { cancelled = true; };
    }, [revision]);

    async function handleDelete() {
        if (!deleting || !canManage || busy) return;
        setBusy(true);
        try {
            await commonAreaService.delete(deleting.id);
            toast.success('Área comum removida.');
            setDeleting(null);
            setRevision(value => value + 1);
        } catch (err) {
            toast.error(apiErrorMessage(err, 'Erro ao remover área comum.'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div>
            <Header title="Áreas comuns" eyebrow="Espaços e convivência" />
            <PageBody>
                <SectionHeader title="Áreas comuns" eyebrow="Vida em comunidade"
                    subtitle="Consulte a capacidade, as regras e a disponibilidade dos espaços."
                    action={canManage && <button className="btn-gold" onClick={() => setEditing(null)}>
                        <Plus size={14} /> Nova área
                    </button>} />
                <ListMeta count={areas.length} singular="área comum" plural="áreas comuns" />
                {error ? <div role="alert" className="luxe-card" style={{ padding: 24, color: 'var(--color-err)' }}>
                    <p>{error}</p><button className="btn-ghost" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button>
                </div> : loading ? <p role="status"><Loader2 size={18} className="animate-spin" /> Carregando áreas comuns...</p>
                    : areas.length === 0 ? <div className="luxe-card"><EmptyTable title="Nenhuma área comum cadastrada" /></div>
                    : <div className="luxe-card" style={{ overflowX: 'auto' }}>
                        <table className="luxe-table">
                            <thead><tr><th>Nome e descrição</th><th>Capacidade</th><th>Regras</th><th>Status</th>{canManage && <th>Ações</th>}</tr></thead>
                            <tbody>{areas.map(area => <tr key={area.id}>
                                <td><strong>{area.name}</strong><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{area.description}</p></td>
                                <td>{area.capacity === null ? 'Não informada' : `${area.capacity} pessoas`}</td>
                                <td style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', minWidth: 180 }}>{area.rules || 'Não informadas'}</td>
                                <td><Tag tone={area.isActive ? 'ok' : 'neutral'} dot>{area.isActive ? 'Ativa' : 'Inativa'}</Tag></td>
                                {canManage && <td><div style={{ display: 'flex', gap: 8 }}>
                                    <IconBtn icon={<Pencil size={14} />} title={`Editar ${area.name}`} onClick={() => setEditing(area)} />
                                    <IconBtn icon={<Trash2 size={14} />} danger title={`Remover ${area.name}`} onClick={() => setDeleting(area)} />
                                </div></td>}
                            </tr>)}</tbody>
                        </table>
                    </div>}
            </PageBody>
            {canManage && editing !== undefined && <CommonAreaFormModal area={editing}
                onClose={() => setEditing(undefined)} onSuccess={() => { setEditing(undefined); setRevision(value => value + 1); }} />}
            {canManage && <DeleteModal open={!!deleting} isDeleting={busy} title="Remover área comum"
                description={<>Deseja remover a área {deleting?.name}? Se houver reservas futuras pendentes ou aprovadas, desative a área pela edição.</>}
                onClose={() => setDeleting(null)} onConfirm={handleDelete} />}
        </div>
    );
}
