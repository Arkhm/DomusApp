import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import PageBody from '../../components/luxury/PageBody';
import SectionHeader from '../../components/luxury/SectionHeader';
import { DeleteModal, EmptyTable, IconBtn, ListMeta } from '../../components/luxury/ListHelpers';
import { useAuth } from '../../hooks/useAuth';
import { apiErrorMessage } from '../../lib/apiError';
import { vehicleService } from '../../services/vehicleService';
import { unitService } from '../../services/unitService';
import { formatUnitDisplay, type Unit } from '../../types/user';
import type { PanelVehicle, VehicleFilters } from '../../types/vehicle';
import VehicleFormModal from './VehicleFormModal';

export default function VehiclesList() {
    const { user } = useAuth();
    const canWrite = user?.role === 'ADMIN';
    const canView = canWrite || user?.role === 'FUNCIONARIO';
    const [vehicles, setVehicles] = useState<PanelVehicle[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [filters, setFilters] = useState<VehicleFilters>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    const [editing, setEditing] = useState<PanelVehicle | null | undefined>();
    const [deleting, setDeleting] = useState<PanelVehicle | null>(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (!canView) return;
        let cancelled = false;
        setLoading(true);
        setError('');
        Promise.all([vehicleService.getAll(filters), unitService.getAll()])
            .then(([data, allUnits]) => { if (!cancelled) { setVehicles(data); setUnits(allUnits); } })
            .catch(err => { if (!cancelled) setError(apiErrorMessage(err, 'Erro ao carregar veículos.')); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [canView, filters, revision]);
    function reload() { setRevision(value => value + 1); }
    async function remove() {
        if (!canWrite || !deleting || busy) return;
        setBusy(true);
        try {
            await vehicleService.delete(deleting.id);
            toast.success('Veículo removido.');
            setDeleting(null);
            reload();
        } catch (err) { toast.error(apiErrorMessage(err, 'Erro ao remover veículo.')); }
        finally { setBusy(false); }
    }
    const blocks = [...new Set(units.map(unit => unit.block).filter((block): block is string => !!block))].sort();
    const filteredUnits = units.filter(unit => !filters.block || unit.block === filters.block);
    if (!canView) return <div><Header title="Veículos" /><PageBody><p role="alert">Acesso restrito à administração e aos funcionários.</p></PageBody></div>;
    return <div>
        <Header title="Veículos" eyebrow="Estacionamento" />
        <PageBody>
            <SectionHeader title="Veículos cadastrados" eyebrow="Estacionamento"
                subtitle={canWrite ? 'Gerencie os veículos e acompanhe a ocupação das vagas por unidade.' : 'Consulte placas e unidades para o controle da portaria.'}
                action={canWrite ? <button className="btn-gold" disabled={loading || !!error} onClick={() => setEditing(null)}><Plus size={14} /> Novo veículo</button> : undefined} />
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
                <label>Buscar por placa
                    <input className="luxe-input" maxLength={20} placeholder="Placa completa ou parcial" value={filters.plate ?? ''}
                        onChange={event => setFilters({ ...filters, plate: event.target.value || undefined })} />
                </label>
                <label>Bloco / quadra
                    <select className="luxe-input" value={filters.block ?? ''} onChange={event => setFilters({ ...filters, block: event.target.value || undefined, unitId: undefined })}>
                        <option value="">Todos os blocos / quadras</option>
                        {blocks.map(block => <option key={block} value={block}>{block}</option>)}
                    </select>
                </label>
                <label>Unidade
                    <select className="luxe-input" value={filters.unitId ?? ''} onChange={event => setFilters({ ...filters, unitId: event.target.value || undefined })}>
                        <option value="">Todas as unidades</option>
                        {filteredUnits.map(unit => <option key={unit.id} value={unit.id}>{formatUnitDisplay(unit)}</option>)}
                    </select>
                </label>
                <button className="btn-ghost" onClick={() => setFilters({})}>Limpar filtros</button>
            </div>
            <ListMeta count={vehicles.length} singular="veículo" plural="veículos" />
            {error ? <div role="alert" className="luxe-card" style={{ padding: 24 }}>
                <p>{error}</p><button className="btn-ghost" onClick={reload}>Tentar novamente</button>
            </div> : loading ? <p role="status"><Loader2 size={18} className="animate-spin" /> Carregando veículos...</p>
                : !vehicles.length ? <div className="luxe-card"><EmptyTable title="Nenhum veículo encontrado" hint={canWrite ? 'Cadastre um veículo ou ajuste os filtros.' : 'Ajuste os filtros para consultar os veículos.'} /></div>
                : <div className="luxe-card" style={{ overflowX: 'auto' }}><table className="luxe-table">
                    <thead><tr><th>Placa</th><th>Modelo</th><th>Cor</th><th>Unidade</th><th>Ocupação da unidade</th>{canWrite && <th>Ações</th>}</tr></thead>
                    <tbody>{vehicles.map(vehicle => <tr key={vehicle.id}>
                        <td>{vehicle.plate}</td>
                        <td style={{ overflowWrap: 'anywhere', maxWidth: 280 }}>{vehicle.model}</td>
                        <td style={{ overflowWrap: 'anywhere', maxWidth: 180 }}>{vehicle.color || '—'}</td>
                        <td>{formatUnitDisplay(vehicle.unit)}</td>
                        <td>{vehicle.unit._count.vehicles} de {vehicle.unit.parkingSpots} {vehicle.unit.parkingSpots === 1 ? 'vaga' : 'vagas'}</td>
                        {canWrite && <td><div style={{ display: 'flex', gap: 8 }}>
                            <IconBtn icon={<Pencil size={14} />} title={`Editar veículo ${vehicle.plate}`} onClick={() => setEditing(vehicle)} />
                            <IconBtn danger icon={<Trash2 size={14} />} title={`Remover veículo ${vehicle.plate}`} onClick={() => setDeleting(vehicle)} />
                        </div></td>}
                    </tr>)}</tbody>
                </table></div>}
        </PageBody>
        {canWrite && editing !== undefined && <VehicleFormModal vehicle={editing} units={units} onClose={() => setEditing(undefined)}
            onSuccess={() => { setEditing(undefined); reload(); }} />}
        <DeleteModal open={canWrite && !!deleting} isDeleting={busy} title="Remover veículo"
            description={<>Deseja remover o veículo de placa {deleting?.plate}? A vaga ficará disponível para outro cadastro na unidade.</>}
            onClose={() => setDeleting(null)} onConfirm={remove} />
    </div>;
}
