import { useState, type FormEvent } from 'react';
import { Car } from 'lucide-react';
import toast from 'react-hot-toast';
import LuxuryModal, { LuxuryModalFooter } from '../../components/luxury/LuxuryModal';
import { parkingSpotService } from '../../services/parkingSpotService';
import { PARKING_TYPE_LABELS, type ParkingSpot, type ParkingType } from '../../types/parkingSpot';
import { apiErrorMessage } from '../../lib/apiError';

interface Props { spot: ParkingSpot | null; onClose: () => void; onSuccess: () => void }
export default function ParkingSpotFormModal({ spot, onClose, onSuccess }: Props) {
    const [number, setNumber] = useState(spot?.number ?? '');
    const [type, setType] = useState<ParkingType>(spot?.type ?? 'RESIDENT');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (busy) return;
        const normalized = number.replace(/\s+/g, '').toUpperCase();
        if (!normalized || normalized.length > 80) { setError('Informe um número com até 80 caracteres.'); return; }
        setBusy(true);
        setError('');
        try {
            const data = { number: normalized, type };
            if (spot) await parkingSpotService.update(spot.id, data);
            else await parkingSpotService.create(data);
            toast.success(spot ? 'Vaga atualizada.' : 'Vaga cadastrada. Atribua uma unidade pela lista.');
            onSuccess();
        } catch (err) { setError(apiErrorMessage(err, 'Erro ao salvar vaga.')); }
        finally { setBusy(false); }
    }
    return <LuxuryModal open onClose={onClose} busy={busy} icon={<Car size={18} />}
        title={spot ? 'Editar vaga' : 'Nova vaga'}>
        <form onSubmit={submit} aria-label="Dados da vaga" style={{ padding: 28, display: 'grid', gap: 18 }}>
            {error && <p role="alert" style={{ color: 'var(--color-err)' }}>{error}</p>}
            <label>Número da vaga
                <input autoFocus required maxLength={80} placeholder="A-01" className="luxe-input"
                    value={number} disabled={busy} onChange={event => setNumber(event.target.value)} />
            </label>
            <label>Tipo
                <select className="luxe-input" value={type} disabled={busy} onChange={event => setType(event.target.value as ParkingType)}>
                    {Object.entries(PARKING_TYPE_LABELS).map(([value, label]) =>
                        <option key={value} value={value} disabled={value === 'VISITOR' && !!spot?.unitId}>{label}</option>)}
                </select>
            </label>
            {spot?.unitId && <p>Para usar o tipo visitante, desatribua a unidade pela lista primeiro.</p>}
            <LuxuryModalFooter onCancel={onClose} submitLabel="Salvar" loadingLabel="Salvando..." isSubmitting={busy} />
        </form>
    </LuxuryModal>;
}
