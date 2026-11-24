import { useEffect, useState, type FormEvent } from 'react';
import { PawPrint } from 'lucide-react';
import toast from 'react-hot-toast';
import LuxuryModal, { LuxuryModalFooter } from '../../components/luxury/LuxuryModal';
import { petService } from '../../services/petService';
import { userService } from '../../services/userService';
import { formatUnitDisplay, type User } from '../../types/user';
import { PET_SPECIES_LABELS, PET_SIZE_LABELS, type Pet, type PetSpecies, type PetSize } from '../../types/pet';
import { apiErrorMessage } from '../../lib/apiError';

interface Props { pet: Pet | null; onClose: () => void; onSuccess: () => void }
export default function PetFormModal({ pet, onClose, onSuccess }: Props) {
    const [name, setName] = useState(pet?.name ?? '');
    const [species, setSpecies] = useState<PetSpecies>(pet?.species ?? 'CACHORRO');
    const [size, setSize] = useState<PetSize>(pet?.size ?? 'PEQUENO');
    const [ownerId, setOwnerId] = useState('');
    const [owners, setOwners] = useState<User[]>([]);
    const [loadingOwners, setLoadingOwners] = useState(!pet);
    const [ownerError, setOwnerError] = useState('');
    const [revision, setRevision] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (pet) return;
        let cancelled = false;
        setLoadingOwners(true);
        setOwnerError('');
        userService.getAll()
            .then(users => { if (!cancelled) setOwners(users.filter(user => user.role === 'MORADOR' && user.status === 'ACTIVE')
                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))); })
            .catch(err => { if (!cancelled) setOwnerError(apiErrorMessage(err, 'Erro ao carregar moradores.')); })
            .finally(() => { if (!cancelled) setLoadingOwners(false); });
        return () => { cancelled = true; };
    }, [pet, revision]);

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (busy) return;
        if (!name.trim() || name.trim().length > 191) { setError('Informe o nome com até 191 caracteres.'); return; }
        if (!pet && (loadingOwners || ownerError || !owners.some(owner => owner.id === ownerId))) {
            setError('Selecione um morador ativo.'); return;
        }
        setBusy(true);
        setError('');
        try {
            const data = { name: name.trim(), species, size };
            if (pet) await petService.update(pet.id, data);
            else await petService.create({ ...data, ownerId });
            toast.success(pet ? 'Pet atualizado.' : 'Pet cadastrado.');
            onSuccess();
        } catch (err) { setError(apiErrorMessage(err, 'Erro ao salvar pet.')); }
        finally { setBusy(false); }
    }
    return <LuxuryModal open onClose={onClose} busy={busy} icon={<PawPrint size={18} />} title={pet ? 'Editar pet' : 'Novo pet'}>
        <form onSubmit={submit} aria-label="Dados do pet" style={{ padding: 28, display: 'grid', gap: 18 }}>
            {error && <p role="alert" style={{ color: 'var(--color-err)' }}>{error}</p>}
            <label>Nome
                <input autoFocus required maxLength={191} className="luxe-input" value={name} disabled={busy} onChange={event => setName(event.target.value)} />
            </label>
            <label>Espécie
                <select className="luxe-input" value={species} disabled={busy} onChange={event => setSpecies(event.target.value as PetSpecies)}>
                    {Object.entries(PET_SPECIES_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
            </label>
            <label>Porte
                <select className="luxe-input" value={size} disabled={busy} onChange={event => setSize(event.target.value as PetSize)}>
                    {Object.entries(PET_SIZE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
            </label>
            {pet ? <p>Dono: {pet.owner.name} ({formatUnitDisplay(pet.owner.unit)}). O dono não pode ser alterado.</p> : <>
                <label>Morador dono
                    <select required className="luxe-input" value={ownerId} disabled={busy || loadingOwners || !!ownerError} onChange={event => setOwnerId(event.target.value)}>
                        <option value="">Selecione o morador</option>
                        {owners.map(owner => <option key={owner.id} value={owner.id}>{owner.name} · {owner.unit ? formatUnitDisplay(owner.unit) : 'Sem unidade'}{owner.phone ? ` · ${owner.phone}` : ''}</option>)}
                    </select>
                </label>
                {loadingOwners ? <p role="status">Carregando moradores...</p> : ownerError ? <div role="alert">
                    <p>{ownerError}</p><button type="button" className="btn-ghost" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button>
                </div> : !owners.length && <p>Nenhum morador ativo disponível.</p>}
            </>}
            <LuxuryModalFooter onCancel={onClose} submitLabel="Salvar" loadingLabel="Salvando..." isSubmitting={busy} />
        </form>
    </LuxuryModal>;
}
