import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import PageBody from '../../components/luxury/PageBody';
import SectionHeader from '../../components/luxury/SectionHeader';
import { DeleteModal, EmptyTable, IconBtn, ListMeta } from '../../components/luxury/ListHelpers';
import { useAuth } from '../../hooks/useAuth';
import { apiErrorMessage } from '../../lib/apiError';
import { petService } from '../../services/petService';
import { unitService } from '../../services/unitService';
import { formatUnitDisplay, type Unit } from '../../types/user';
import { PET_SPECIES_LABELS, PET_SIZE_LABELS, type Pet, type PetFilters, type PetSpecies, type PetSize } from '../../types/pet';
import PetFormModal from './PetFormModal';

export default function PetsList() {
    const { user } = useAuth();
    const canWrite = user?.role === 'ADMIN';
    const canRead = canWrite || user?.role === 'FUNCIONARIO';
    const [pets, setPets] = useState<Pet[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [filters, setFilters] = useState<PetFilters>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    const [editing, setEditing] = useState<Pet | null | undefined>();
    const [deleting, setDeleting] = useState<Pet | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!canRead) return;
        let cancelled = false;
        setLoading(true);
        setError('');
        const timer = window.setTimeout(() => {
            Promise.all([petService.getAll(filters), unitService.getAll()])
                .then(([data, allUnits]) => { if (!cancelled) { setPets(data); setUnits(allUnits); } })
                .catch(err => { if (!cancelled) setError(apiErrorMessage(err, 'Erro ao carregar pets.')); })
                .finally(() => { if (!cancelled) setLoading(false); });
        }, 250);
        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [canRead, filters, revision]);

    function reload() { setRevision(value => value + 1); }
    async function remove() {
        if (!canWrite || !deleting || busy) return;
        setBusy(true);
        try {
            await petService.delete(deleting.id);
            toast.success('Pet removido.');
            setDeleting(null);
            reload();
        } catch (err) { toast.error(apiErrorMessage(err, 'Erro ao remover pet.')); }
        finally { setBusy(false); }
    }
    const blocks = [...new Set(units.map(unit => unit.block).filter((block): block is string => !!block))].sort();
    const visibleUnits = units.filter(unit => !filters.block || unit.block === filters.block);

    if (!canRead) return <div><Header title="Pets" /><PageBody><p role="alert">Acesso restrito à administração e aos funcionários.</p></PageBody></div>;
    return <div>
        <Header title="Pets" eyebrow="Condomínio" />
        <PageBody>
            <SectionHeader title="Pets do condomínio" eyebrow="Cadastros" subtitle="Consulte os pets, seus donos e suas unidades."
                action={canWrite && <button className="btn-gold" onClick={() => setEditing(null)}><Plus size={14} /> Novo pet</button>} />
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
                <label>Buscar pet ou dono
                    <input type="search" className="luxe-input" maxLength={191} placeholder="Nome do pet ou do dono" value={filters.search ?? ''}
                        onChange={event => setFilters({ ...filters, search: event.target.value || undefined })} />
                </label>
                <label>Espécie
                    <select className="luxe-input" value={filters.species ?? ''} onChange={event => setFilters({ ...filters, species: (event.target.value || undefined) as PetSpecies | undefined })}>
                        <option value="">Todas as espécies</option>
                        {Object.entries(PET_SPECIES_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                </label>
                <label>Porte
                    <select className="luxe-input" value={filters.size ?? ''} onChange={event => setFilters({ ...filters, size: (event.target.value || undefined) as PetSize | undefined })}>
                        <option value="">Todos os portes</option>
                        {Object.entries(PET_SIZE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
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
                        {visibleUnits.map(unit => <option key={unit.id} value={unit.id}>{formatUnitDisplay(unit)}</option>)}
                    </select>
                </label>
                <button className="btn-ghost" onClick={() => setFilters({})}>Limpar filtros</button>
            </div>
            {!loading && !error && <ListMeta count={pets.length} singular="pet" plural="pets" />}
            {error ? <div role="alert" className="luxe-card" style={{ padding: 24 }}>
                <p>{error}</p><button className="btn-ghost" onClick={reload}>Tentar novamente</button>
            </div> : loading ? <p role="status"><Loader2 size={18} className="animate-spin" /> Carregando pets...</p>
                : !pets.length ? <div className="luxe-card"><EmptyTable title="Nenhum pet encontrado" hint={canWrite ? 'Cadastre um pet ou ajuste os filtros.' : 'Ajuste os filtros para consultar os pets.'} /></div>
                : <div className="luxe-card" style={{ overflowX: 'auto' }}><table className="luxe-table">
                    <thead><tr><th>Nome</th><th>Espécie</th><th>Porte</th><th>Dono</th><th>Unidade</th>{canWrite && <th>Ações</th>}</tr></thead>
                    <tbody>{pets.map(pet => <tr key={pet.id}>
                        <td style={{ overflowWrap: 'anywhere', maxWidth: 280 }}>{pet.name}</td>
                        <td>{PET_SPECIES_LABELS[pet.species] ?? pet.species}</td>
                        <td>{PET_SIZE_LABELS[pet.size] ?? pet.size}</td>
                        <td>{pet.owner.name}{pet.owner.phone && <div style={{ color: 'var(--color-bone-muted)' }}>{pet.owner.phone}</div>}</td>
                        <td>{pet.owner.unit ? formatUnitDisplay(pet.owner.unit) : 'Sem unidade'}</td>
                        {canWrite && <td><div style={{ display: 'flex', gap: 8 }}>
                            <IconBtn icon={<Pencil size={14} />} title={`Editar pet ${pet.name}`} onClick={() => setEditing(pet)} />
                            <IconBtn danger icon={<Trash2 size={14} />} title={`Remover pet ${pet.name}`} onClick={() => setDeleting(pet)} />
                        </div></td>}
                    </tr>)}</tbody>
                </table></div>}
        </PageBody>
        {canWrite && editing !== undefined && <PetFormModal pet={editing} onClose={() => setEditing(undefined)} onSuccess={() => { setEditing(undefined); reload(); }} />}
        {canWrite && <DeleteModal open={!!deleting} isDeleting={busy} title="Remover pet" description={<>Deseja remover o pet {deleting?.name}? Esta ação não pode ser desfeita.</>}
            onClose={() => setDeleting(null)} onConfirm={remove} />}
    </div>;
}
