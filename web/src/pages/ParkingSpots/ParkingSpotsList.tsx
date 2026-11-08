import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, Car } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import PageBody from '../../components/luxury/PageBody';
import SectionHeader from '../../components/luxury/SectionHeader';
import Tag from '../../components/luxury/Tag';
import LuxuryModal, { LuxuryModalFooter } from '../../components/luxury/LuxuryModal';
import { DeleteModal, EmptyTable, IconBtn, ListMeta } from '../../components/luxury/ListHelpers';
import { useAuth } from '../../hooks/useAuth';
import { apiErrorMessage } from '../../lib/apiError';
import { parkingSpotService } from '../../services/parkingSpotService';
import { unitService } from '../../services/unitService';
import { formatUnitDisplay, type Unit } from '../../types/user';
import { PARKING_TYPE_LABELS, type ParkingSpot, type ParkingSpotFilters, type ParkingType } from '../../types/parkingSpot';
import ParkingSpotFormModal from './ParkingSpotFormModal';

export default function ParkingSpotsList() {
    const { user } = useAuth();
    const canManage = user?.role === 'ADMIN' || user?.role === 'FUNCIONARIO';
    const [spots, setSpots] = useState<ParkingSpot[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [filters, setFilters] = useState<ParkingSpotFilters>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    const [editing, setEditing] = useState<ParkingSpot | null | undefined>();
    const [deleting, setDeleting] = useState<ParkingSpot | null>(null);
    const [assigning, setAssigning] = useState<ParkingSpot | null>(null);
    const [unitId, setUnitId] = useState('');
    const [busy, setBusy] = useState(false);
    const [assignError, setAssignError] = useState('');

    useEffect(() => {
        if (!canManage) return;
        let cancelled = false;
        setLoading(true);
        setError('');
        Promise.all([parkingSpotService.getAll(filters), unitService.getAll()])
            .then(([data, allUnits]) => { if (!cancelled) { setSpots(data); setUnits(allUnits); } })
            .catch(err => { if (!cancelled) setError(apiErrorMessage(err, 'Erro ao carregar vagas.')); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [canManage, filters, revision]);

    function reload() { setRevision(value => value + 1); }
    async function remove() {
        if (!deleting || busy) return;
        setBusy(true);
        try {
            await parkingSpotService.delete(deleting.id);
            toast.success('Vaga removida.');
            setDeleting(null);
            reload();
        } catch (err) { toast.error(apiErrorMessage(err, 'Erro ao remover vaga.')); }
        finally { setBusy(false); }
    }
    async function assign(event: React.FormEvent) {
        event.preventDefault();
        if (!assigning || busy) return;
        setBusy(true);
        setAssignError('');
        try {
            await parkingSpotService.assign(assigning.id, unitId || null);
            toast.success(unitId ? 'Vaga atribuída.' : 'Vaga desatribuída.');
            setAssigning(null);
            reload();
        } catch (err) { setAssignError(apiErrorMessage(err, 'Erro ao atribuir vaga.')); }
        finally { setBusy(false); }
    }
    const blocks = [...new Set(units.map(unit => unit.block).filter((block): block is string => !!block))].sort();

    if (!canManage) return <div><Header title="Vagas" /><PageBody><p role="alert">Acesso restrito à administração e aos funcionários.</p></PageBody></div>;
    return <div>
        <Header title="Vagas" eyebrow="Estacionamento" />
        <PageBody>
            <SectionHeader title="Vagas numeradas" eyebrow="Estacionamento"
                subtitle="Cadastre os números e vincule as vagas de morador ou PcD às unidades. Renomeie os números PROV para os números físicos."
                action={<button className="btn-gold" onClick={() => setEditing(null)}><Plus size={14} /> Nova vaga</button>} />
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
                <label>Tipo
                    <select className="luxe-input" value={filters.type ?? ''} onChange={event => setFilters({ ...filters, type: (event.target.value || undefined) as ParkingType | undefined })}>
                        <option value="">Todos os tipos</option>
                        {Object.entries(PARKING_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                </label>
                <label>Bloco / quadra
                    <select className="luxe-input" value={filters.block ?? ''} onChange={event => setFilters({ ...filters, block: event.target.value || undefined })}>
                        <option value="">Todos os blocos / quadras</option>
                        {blocks.map(block => <option key={block} value={block}>{block}</option>)}
                    </select>
                </label>
                <label>Unidade
                    <select className="luxe-input" value={filters.unitId ?? ''} onChange={event => setFilters({ ...filters, unitId: event.target.value || undefined })}>
                        <option value="">Todas as unidades</option>
                        {units.map(unit => <option key={unit.id} value={unit.id}>{formatUnitDisplay(unit)}</option>)}
                    </select>
                </label>
                <label>Disponibilidade
                    <select className="luxe-input" value={filters.free ?? ''} onChange={event => setFilters({ ...filters, free: (event.target.value || undefined) as 'true' | 'false' | undefined })}>
                        <option value="">Todas</option><option value="true">Livres (sem unidade)</option><option value="false">Atribuídas</option>
                    </select>
                </label>
                <button className="btn-ghost" onClick={() => setFilters({})}>Limpar filtros</button>
            </div>
            <ListMeta count={spots.length} singular="vaga" plural="vagas" />
            {error ? <div role="alert" className="luxe-card" style={{ padding: 24 }}>
                <p>{error}</p><button className="btn-ghost" onClick={reload}>Tentar novamente</button>
            </div> : loading ? <p role="status"><Loader2 size={18} className="animate-spin" /> Carregando vagas...</p>
                : !spots.length ? <div className="luxe-card"><EmptyTable title="Nenhuma vaga encontrada" hint="Cadastre uma vaga ou ajuste os filtros." /></div>
                : <div className="luxe-card" style={{ overflowX: 'auto' }}><table className="luxe-table">
                    <thead><tr><th>Número</th><th>Tipo</th><th>Unidade</th><th>Ações</th></tr></thead>
                    <tbody>{spots.map(spot => <tr key={spot.id}>
                        <td style={{ overflowWrap: 'anywhere', maxWidth: 280 }}>{spot.number}</td>
                        <td><Tag tone={spot.type === 'DISABLED' ? 'ok' : 'neutral'}>{PARKING_TYPE_LABELS[spot.type]}</Tag></td>
                        <td>{spot.unit ? formatUnitDisplay(spot.unit) : 'Livre'}</td>
                        <td><div style={{ display: 'flex', gap: 8 }}>
                            <IconBtn icon={<Pencil size={14} />} title={`Editar vaga ${spot.number}`} onClick={() => setEditing(spot)} />
                            <button className="btn-ghost" disabled={spot.type === 'VISITOR'} onClick={() => {
                                setAssigning(spot); setUnitId(spot.unitId ?? ''); setAssignError('');
                            }}>{spot.unitId ? 'Alterar unidade' : 'Atribuir unidade'}</button>
                            <IconBtn danger icon={<Trash2 size={14} />} title={`Remover vaga ${spot.number}`} onClick={() => setDeleting(spot)} />
                        </div></td>
                    </tr>)}</tbody>
                </table></div>}
        </PageBody>
        {editing !== undefined && <ParkingSpotFormModal spot={editing} onClose={() => setEditing(undefined)}
            onSuccess={() => { setEditing(undefined); reload(); }} />}
        <DeleteModal open={!!deleting} isDeleting={busy} title="Remover vaga"
            description={<>Deseja remover a vaga {deleting?.number}? A remoção será bloqueada se a unidade ficar com mais veículos do que vagas.</>}
            onClose={() => setDeleting(null)} onConfirm={remove} />
        {assigning && <LuxuryModal open onClose={() => setAssigning(null)} busy={busy} icon={<Car size={18} />} title={`Unidade da vaga ${assigning.number}`}>
            <form onSubmit={assign} style={{ padding: 28, display: 'grid', gap: 18 }}>
                {assignError && <p role="alert" style={{ color: 'var(--color-err)' }}>{assignError}</p>}
                <label>Unidade
                    <select className="luxe-input" disabled={busy} value={unitId} onChange={event => setUnitId(event.target.value)}>
                        <option value="">Livre (desatribuir)</option>
                        {units.map(unit => <option key={unit.id} value={unit.id}>{formatUnitDisplay(unit)}</option>)}
                    </select>
                </label>
                <p>Vagas de visitante não podem ser atribuídas. Para reduzir vagas, remova primeiro os veículos excedentes.</p>
                <LuxuryModalFooter onCancel={() => setAssigning(null)} submitLabel="Salvar" loadingLabel="Salvando..." isSubmitting={busy} />
            </form>
        </LuxuryModal>}
    </div>;
}
