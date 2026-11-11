import { useEffect, useState, type FormEvent } from 'react';
import { Car, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import LuxuryModal from '../../components/luxury/LuxuryModal';
import { vehicleService } from '../../services/vehicleService';
import { apiErrorMessage } from '../../lib/apiError';
import { formatUnitDisplay, type Unit } from '../../types/user';
import type { PanelVehicle } from '../../types/vehicle';

interface Props { vehicle: PanelVehicle | null; units: Unit[]; onClose: () => void; onSuccess: () => void }
export default function VehicleFormModal({ vehicle, units, onClose, onSuccess }: Props) {
    const [plate, setPlate] = useState(vehicle?.plate ?? '');
    const [model, setModel] = useState(vehicle?.model ?? '');
    const [color, setColor] = useState(vehicle?.color ?? '');
    const [unitId, setUnitId] = useState(vehicle?.unitId ?? '');
    const [capacity, setCapacity] = useState<{ unitId: string; used: number; total: number } | null>(null);
    const [capacityError, setCapacityError] = useState('');
    const [checking, setChecking] = useState(false);
    const [revision, setRevision] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const selected = units.find(unit => unit.id === unitId);
    useEffect(() => {
        if (vehicle || !selected) return;
        let cancelled = false;
        setChecking(true);
        setCapacity(null);
        setCapacityError('');
        vehicleService.getAll({ unitId: selected.id })
            .then(vehicles => {
                if (!cancelled) setCapacity({ unitId: selected.id, used: vehicles.length,
                    total: vehicles[0]?.unit.parkingSpots ?? selected.parkingSpots ?? 0 });
            })
            .catch(err => { if (!cancelled) setCapacityError(apiErrorMessage(err, 'Erro ao consultar vagas.')); })
            .finally(() => { if (!cancelled) setChecking(false); });
        return () => { cancelled = true; };
    }, [vehicle, selected, revision]);
    const available = capacity?.unitId === unitId ? Math.max(0, capacity.total - capacity.used) : null;
    const blocked = !vehicle && (!unitId || checking || available === null || available === 0 || !!capacityError);
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (busy || blocked) return;
        const normalized = plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalized)) {
            setError('Informe uma placa válida, como ABC1234 ou ABC1D23.'); return;
        }
        if (!model.trim()) { setError('Informe o modelo do veículo.'); return; }
        setBusy(true);
        setError('');
        try {
            const data = { plate: normalized, model: model.trim(), color: color.trim() };
            if (vehicle) await vehicleService.update(vehicle.id, data);
            else await vehicleService.create({ ...data, unitId });
            toast.success(vehicle ? 'Veículo atualizado.' : 'Veículo cadastrado.');
            onSuccess();
        } catch (err) {
            setError(apiErrorMessage(err, 'Erro ao salvar veículo.'));
            if (!vehicle) setRevision(value => value + 1);
        } finally { setBusy(false); }
    }
    return <LuxuryModal open onClose={onClose} busy={busy} icon={<Car size={18} />}
        title={vehicle ? 'Editar veículo' : 'Novo veículo'}>
        <form onSubmit={submit} aria-label="Dados do veículo" style={{ padding: 28, display: 'grid', gap: 18 }}>
            {error && <p role="alert" style={{ color: 'var(--color-err)' }}>{error}</p>}
            {vehicle ? <p>Unidade: {formatUnitDisplay(vehicle.unit)}</p> : <>
                <label>Unidade
                    <select autoFocus required className="luxe-input" disabled={busy} value={unitId} onChange={event => setUnitId(event.target.value)}>
                        <option value="">Selecione a unidade</option>
                        {units.map(unit => <option key={unit.id} value={unit.id}>{formatUnitDisplay(unit)}</option>)}
                    </select>
                </label>
                {unitId && <div aria-live="polite">
                    {checking ? <p role="status"><Loader2 size={14} className="animate-spin" /> Consultando vagas...</p>
                        : capacityError ? <div role="alert"><p>{capacityError}</p><button type="button" className="btn-ghost" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button></div>
                        : available !== null && <p>{available} {available === 1 ? 'vaga livre' : 'vagas livres'} de {capacity?.total}.{available === 0 && ' A unidade está sem vagas disponíveis.'}</p>}
                </div>}
            </>}
            <label>Placa
                <input autoFocus={!!vehicle} required maxLength={20} placeholder="ABC1D23" className="luxe-input"
                    disabled={busy} value={plate} onChange={event => setPlate(event.target.value)} />
            </label>
            <label>Modelo
                <input required maxLength={191} className="luxe-input" disabled={busy} value={model} onChange={event => setModel(event.target.value)} />
            </label>
            <label>Cor (opcional)
                <input maxLength={191} className="luxe-input" disabled={busy} value={color} onChange={event => setColor(event.target.value)} />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 20, borderTop: '1px solid var(--color-line)' }}>
                <button type="button" className="btn-ghost" disabled={busy} onClick={onClose}>Cancelar</button>
                <button type="submit" className="btn-gold" disabled={busy || blocked}>{busy ? 'Salvando...' : 'Salvar'}</button>
            </div>
        </form>
    </LuxuryModal>;
}
