import { useState, type FormEvent } from 'react';
import { TreePalm } from 'lucide-react';
import toast from 'react-hot-toast';
import LuxuryModal, { LuxuryModalFooter } from '../../components/luxury/LuxuryModal';
import { commonAreaService } from '../../services/commonAreaService';
import type { CommonArea } from '../../types/commonArea';
import { apiErrorMessage } from '../../lib/apiError';

interface Props {
    area: CommonArea | null;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CommonAreaFormModal({ area, onClose, onSuccess }: Props) {
    const [name, setName] = useState(area?.name ?? '');
    const [description, setDescription] = useState(area?.description ?? '');
    const [capacity, setCapacity] = useState(area?.capacity?.toString() ?? '');
    const [rules, setRules] = useState(area?.rules ?? '');
    const [isActive, setIsActive] = useState(area?.isActive ?? true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (busy) return;
        const value = capacity === '' ? null : Number(capacity);
        if (!name.trim() || name.trim().length > 100) {
            setError('Informe um nome com até 100 caracteres.');
            return;
        }
        if (value !== null && (!Number.isSafeInteger(value) || value <= 0)) {
            setError('A capacidade deve ser um número inteiro maior que zero.');
            return;
        }
        setBusy(true);
        setError('');
        const data = { name: name.trim(), description: description.trim() || null,
            capacity: value, rules: rules.trim() || null, isActive };
        try {
            if (area) await commonAreaService.update(area.id, data);
            else await commonAreaService.create(data);
            toast.success(area ? 'Área comum atualizada.' : 'Área comum cadastrada.');
            onSuccess();
        } catch (err) {
            setError(apiErrorMessage(err, 'Erro ao salvar área comum.'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <LuxuryModal open onClose={onClose} busy={busy} icon={<TreePalm size={18} />}
            title={area ? 'Editar área comum' : 'Nova área comum'} size="lg">
            <form onSubmit={handleSubmit} aria-label="Dados da área comum"
                style={{ padding: 28, display: 'grid', gap: 18 }}>
                {error && <p role="alert" style={{ color: 'var(--color-err)' }}>{error}</p>}
                <label>Nome
                    <input autoFocus required maxLength={100} className="luxe-input" value={name}
                        disabled={busy} onChange={event => setName(event.target.value)} />
                </label>
                <label>Descrição (opcional)
                    <textarea className="luxe-input" rows={3} value={description}
                        disabled={busy} onChange={event => setDescription(event.target.value)} />
                </label>
                <label>Capacidade (opcional)
                    <input type="number" min={1} step={1} className="luxe-input" value={capacity}
                        disabled={busy} onChange={event => setCapacity(event.target.value)} />
                </label>
                <label>Regras (opcional)
                    <textarea className="luxe-input" rows={4} value={rules}
                        disabled={busy} onChange={event => setRules(event.target.value)} />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={isActive} disabled={busy}
                        onChange={event => setIsActive(event.target.checked)} /> Área ativa
                </label>
                <LuxuryModalFooter onCancel={onClose} submitLabel="Salvar" loadingLabel="Salvando..." isSubmitting={busy} />
            </form>
        </LuxuryModal>
    );
}
