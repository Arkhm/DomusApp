import { useMemo, useState, type FormEvent } from 'react';
import { Receipt } from 'lucide-react';
import LuxuryModal, { LuxuryModalFooter } from '../../components/luxury/LuxuryModal';
import Tag from '../../components/luxury/Tag';
import { createKeyKeeper } from '../../lib/idempotency';
import { formatDueDateBR, formatMoneyBR } from '../../lib/invoiceFormat';
import { EMPTY_DRAFT, emissionErrorMessage, residentLabel, validateDraft, type DraftErrors, type DraftFields } from '../../lib/invoiceForm';
import { invoiceService } from '../../services/invoiceService';
import { INVOICE_TYPE_LABELS, ISSUANCE_IN_FLIGHT, ISSUANCE_LABELS, type Invoice, type InvoiceCreateInput } from '../../types/invoice';
import { BlockedResidents, TestEnvironmentNotice } from './EmissionNotes';
import InvoiceFields from './InvoiceFields';
import { useResidents } from './useResidents';

interface Props { onClose: () => void; onCreated: () => void }

function outcome(invoice: Invoice) {
    if (invoice.issuanceStatus === 'ACTIVE') return 'O Pix foi gerado e já está disponível para o morador pagar.';
    if (ISSUANCE_IN_FLIGHT.has(invoice.issuanceStatus)) return 'A cobrança foi registrada e o Pix está sendo gerado. Acompanhe pela coluna Pix da lista.';
    if (invoice.issuanceStatus === 'REVIEW') return 'A cobrança foi registrada, mas a geração do Pix precisa de revisão.';
    return 'A cobrança foi registrada.';
}

/** Emissão individual: uma cobrança para um morador, na unidade dele. */
export default function InvoiceFormModal({ onClose, onCreated }: Props) {
    const { eligible, blocked, error: loadError, loading, retry } = useResidents();
    const [fields, setFields] = useState<DraftFields>(EMPTY_DRAFT);
    const [errors, setErrors] = useState<DraftErrors>({});
    const [residentId, setResidentId] = useState('');
    const [search, setSearch] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [created, setCreated] = useState<Invoice | null>(null);
    const [keyFor] = useState(createKeyKeeper);

    const options = useMemo(() => {
        const term = search.trim().toLowerCase();
        const matches = term ? eligible.filter(user => residentLabel(user).toLowerCase().includes(term)) : eligible;
        const selected = eligible.find(user => user.id === residentId);
        return selected && !matches.includes(selected) ? [selected, ...matches] : matches;
    }, [eligible, search, residentId]);

    function change(patch: Partial<DraftFields>) {
        setFields(current => ({ ...current, ...patch }));
        setErrors(current => {
            const next = { ...current };
            for (const key of Object.keys(patch) as (keyof DraftFields)[]) delete next[key];
            return next;
        });
    }

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (busy) return;
        const resident = eligible.find(user => user.id === residentId);
        const { draft, errors: found } = validateDraft(fields);
        setErrors(found);
        if (!resident) { setError('Selecione o morador que receberá a cobrança.'); return; }
        if (!draft) { setError(''); return; }
        const payload: InvoiceCreateInput = { ...draft, userId: resident.id, unitId: resident.unitId! };
        setBusy(true);
        setError('');
        try {
            const invoice = await invoiceService.create(payload, keyFor(JSON.stringify(payload)));
            setCreated(invoice);
            onCreated();
        } catch (err) {
            setError(emissionErrorMessage(err));
        } finally { setBusy(false); }
    }

    if (created) {
        return (
            <LuxuryModal open onClose={onClose} icon={<Receipt size={18} />} title="Cobrança criada" size="lg">
                <div style={{ padding: 28, display: 'grid', gap: 16 }}>
                    <p>{outcome(created)}</p>
                    <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 18px', margin: 0 }}>
                        <dt>Morador</dt><dd style={{ margin: 0 }}>{created.user?.name ?? '—'}</dd>
                        <dt>Descrição</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{created.description}</dd>
                        <dt>Tipo</dt><dd style={{ margin: 0 }}>{INVOICE_TYPE_LABELS[created.type] ?? created.type}</dd>
                        <dt>Valor</dt><dd style={{ margin: 0 }}>{formatMoneyBR(created.amount)}</dd>
                        <dt>Vencimento</dt><dd style={{ margin: 0 }}>{formatDueDateBR(created.dueDate)}</dd>
                        <dt>Pix</dt><dd style={{ margin: 0 }}><Tag tone={created.issuanceStatus === 'ACTIVE' ? 'ok' : 'warn'}>{ISSUANCE_LABELS[created.issuanceStatus] ?? created.issuanceStatus}</Tag></dd>
                    </dl>
                    <TestEnvironmentNotice invoices={[created]} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--color-line)' }}>
                        <button type="button" className="btn-gold" onClick={onClose}>Fechar</button>
                    </div>
                </div>
            </LuxuryModal>
        );
    }

    return (
        <LuxuryModal open onClose={onClose} busy={busy} icon={<Receipt size={18} />} title="Nova cobrança"
            subtitle="Emite uma cobrança Pix para um morador." size="lg">
            <form onSubmit={submit} noValidate aria-label="Dados da cobrança" style={{ padding: 28, display: 'grid', gap: 18 }}>
                {error && <p role="alert" style={{ color: 'var(--color-err)' }}>{error}</p>}
                {loadError ? (
                    <div role="alert" style={{ color: 'var(--color-err)' }}>
                        <p>{loadError}</p>
                        <button type="button" className="btn-ghost" onClick={retry}>Tentar novamente</button>
                    </div>
                ) : loading ? <p role="status">Carregando moradores...</p> : (
                    <div style={{ display: 'grid', gap: 8 }}>
                        <label>Buscar morador
                            <input autoFocus className="luxe-input" placeholder="Nome ou unidade" value={search}
                                disabled={busy} onChange={event => setSearch(event.target.value)} />
                        </label>
                        <label>Morador
                            <select className="luxe-input" value={residentId} disabled={busy}
                                onChange={event => { setResidentId(event.target.value); setError(''); }}>
                                <option value="">{options.length ? 'Selecione o morador' : 'Nenhum morador encontrado'}</option>
                                {options.map(user => <option key={user.id} value={user.id}>{residentLabel(user)}</option>)}
                            </select>
                        </label>
                        <BlockedResidents blocked={blocked} />
                    </div>
                )}
                <InvoiceFields values={fields} errors={errors} disabled={busy} onChange={change} />
                <LuxuryModalFooter onCancel={onClose} submitLabel="Emitir cobrança" loadingLabel="Emitindo..." isSubmitting={busy} />
            </form>
        </LuxuryModal>
    );
}
