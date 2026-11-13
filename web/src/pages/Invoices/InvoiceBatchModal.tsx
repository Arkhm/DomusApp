import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import LuxuryModal, { LuxuryModalFooter } from '../../components/luxury/LuxuryModal';
import { createKeyKeeper } from '../../lib/idempotency';
import { formatDueDateBR, formatMoneyBR } from '../../lib/invoiceFormat';
import {
    EMPTY_DRAFT, emissionErrorMessage, multiplyAmount, residentLabel, validateDraft,
    type DraftErrors, type DraftFields,
} from '../../lib/invoiceForm';
import { invoiceService } from '../../services/invoiceService';
import {
    INVOICE_TYPE_LABELS, ISSUANCE_IN_FLIGHT, MAX_BATCH_SIZE,
    type InvoiceBatchInput, type InvoiceBatchResult, type InvoiceDraft,
} from '../../types/invoice';
import { formatUnitDisplay } from '../../types/user';
import { BlockedResidents, TestEnvironmentNotice } from './EmissionNotes';
import InvoiceFields from './InvoiceFields';
import { useResidents } from './useResidents';

interface Props { onClose: () => void; onCreated: () => void }
type Step = 'form' | 'review' | 'done';

const rowStyle = {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer',
    borderBottom: '1px solid var(--color-line)',
} as const;

/**
 * Emissão em lote: a mesma cobrança para vários moradores, cada um na própria
 * unidade. A revisão antes de emitir existe porque o lote cria até 100
 * cobranças e só se desfaz cobrança por cobrança.
 */
export default function InvoiceBatchModal({ onClose, onCreated }: Props) {
    const { eligible, blocked, error: loadError, loading, retry } = useResidents();
    const [step, setStep] = useState<Step>('form');
    const [fields, setFields] = useState<DraftFields>(EMPTY_DRAFT);
    const [errors, setErrors] = useState<DraftErrors>({});
    const [draft, setDraft] = useState<InvoiceDraft | null>(null);
    const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
    const [search, setSearch] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<InvoiceBatchResult | null>(null);
    const [keyFor] = useState(createKeyKeeper);

    const visible = useMemo(() => {
        const term = search.trim().toLowerCase();
        return term ? eligible.filter(user => residentLabel(user).toLowerCase().includes(term)) : eligible;
    }, [eligible, search]);
    const recipients = useMemo(() => eligible.filter(user => selected.has(user.id)), [eligible, selected]);
    const sharedUnits = useMemo(() => {
        const perUnit = new Map<string, { label: string; count: number }>();
        for (const user of recipients) {
            const entry = perUnit.get(user.unitId!) ?? { label: formatUnitDisplay(user.unit), count: 0 };
            perUnit.set(user.unitId!, { ...entry, count: entry.count + 1 });
        }
        return [...perUnit.values()].filter(entry => entry.count > 1);
    }, [recipients]);

    function change(patch: Partial<DraftFields>) {
        setFields(current => ({ ...current, ...patch }));
        setErrors(current => {
            const next = { ...current };
            for (const key of Object.keys(patch) as (keyof DraftFields)[]) delete next[key];
            return next;
        });
    }

    function toggle(id: string) {
        setError('');
        setSelected(current => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else if (next.size < MAX_BATCH_SIZE) next.add(id);
            return next;
        });
    }

    function selectVisible() {
        setError('');
        setSelected(current => {
            const next = new Set(current);
            for (const user of visible) if (next.size < MAX_BATCH_SIZE) next.add(user.id);
            return next;
        });
    }

    function review() {
        const { draft: valid, errors: found } = validateDraft(fields);
        setErrors(found);
        if (!recipients.length) { setError('Selecione ao menos um morador.'); return; }
        if (!valid) { setError(''); return; }
        setError('');
        setDraft(valid);
        setStep('review');
    }

    async function emit() {
        if (busy || !draft) return;
        const payload: InvoiceBatchInput = { ...draft, userIds: recipients.map(user => user.id).sort() };
        setBusy(true);
        setError('');
        try {
            const created = await invoiceService.createBatch(payload, keyFor(JSON.stringify(payload)));
            setResult(created);
            setStep('done');
            onCreated();
        } catch (err) {
            setError(emissionErrorMessage(err));
        } finally { setBusy(false); }
    }

    if (step === 'done' && result) {
        const pending = result.created.filter(invoice => ISSUANCE_IN_FLIGHT.has(invoice.issuanceStatus)).length;
        return (
            <LuxuryModal open onClose={onClose} icon={<Users size={18} />} title="Lote emitido" size="lg">
                <div style={{ padding: 28, display: 'grid', gap: 16 }}>
                    <p>
                        <strong>{result.created.length} {result.created.length === 1 ? 'cobrança criada' : 'cobranças criadas'}.</strong>{' '}
                        {pending > 0
                            ? `Os Pix de ${pending} delas estão sendo gerados em segundo plano; a lista se atualiza sozinha.`
                            : 'Os Pix já estão disponíveis.'}
                    </p>
                    {result.errors.length > 0 && (
                        <p role="alert" style={{ color: 'var(--color-err)' }}>
                            {result.errors.length} {result.errors.length === 1 ? 'item não foi emitido' : 'itens não foram emitidos'}. Confira a lista.
                        </p>
                    )}
                    <TestEnvironmentNotice invoices={result.created} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--color-line)' }}>
                        <button type="button" className="btn-gold" onClick={onClose}>Fechar</button>
                    </div>
                </div>
            </LuxuryModal>
        );
    }

    if (step === 'review' && draft) {
        return (
            <LuxuryModal open onClose={onClose} busy={busy} icon={<Users size={18} />} title="Revisar emissão"
                subtitle="Confira antes de emitir. Depois, só é possível cancelar cobrança por cobrança." size="lg">
                <div style={{ padding: 28, display: 'grid', gap: 16 }}>
                    {error && <p role="alert" style={{ color: 'var(--color-err)' }}>{error}</p>}
                    <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 18px', margin: 0 }}>
                        <dt>Descrição</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{draft.description}</dd>
                        <dt>Tipo</dt><dd style={{ margin: 0 }}>{INVOICE_TYPE_LABELS[draft.type]}</dd>
                        <dt>Vencimento</dt><dd style={{ margin: 0 }}>{formatDueDateBR(draft.dueDate)}</dd>
                        <dt>Valor de cada</dt><dd style={{ margin: 0 }}>{formatMoneyBR(draft.amount)}</dd>
                        <dt>Cobranças</dt><dd style={{ margin: 0 }}>{recipients.length}</dd>
                        <dt>Total</dt><dd style={{ margin: 0 }}><strong>{formatMoneyBR(multiplyAmount(draft.amount, recipients.length))}</strong></dd>
                    </dl>
                    <details>
                        <summary style={{ cursor: 'pointer', fontSize: 13 }}>Ver moradores ({recipients.length})</summary>
                        <ul style={{ margin: '8px 0 0', padding: 0, maxHeight: 160, overflow: 'auto', display: 'grid', gap: 2, fontSize: 13 }}>
                            {recipients.map(user => <li key={user.id}>{residentLabel(user)}</li>)}
                        </ul>
                    </details>
                    {sharedUnits.length > 0 && (
                        <p role="note" style={{ fontSize: 13, color: 'var(--color-warn)' }}>
                            Atenção: {sharedUnits.map(entry => `${entry.label} (${entry.count} moradores)`).join(', ')}. Cada morador receberá uma cobrança própria.
                        </p>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 16, borderTop: '1px solid var(--color-line)' }}>
                        <button type="button" className="btn-ghost" disabled={busy} onClick={() => { setError(''); setStep('form'); }}>Voltar</button>
                        <button type="button" className="btn-gold" disabled={busy} onClick={emit}>
                            {busy ? 'Emitindo...' : `Emitir ${recipients.length} ${recipients.length === 1 ? 'cobrança' : 'cobranças'}`}
                        </button>
                    </div>
                </div>
            </LuxuryModal>
        );
    }

    const atLimit = selected.size >= MAX_BATCH_SIZE;
    return (
        <LuxuryModal open onClose={onClose} icon={<Users size={18} />} title="Emitir em lote"
            subtitle="A mesma cobrança para vários moradores, cada um na sua unidade." size="xl">
            <form onSubmit={event => { event.preventDefault(); review(); }} noValidate aria-label="Emissão em lote"
                style={{ padding: 28, display: 'grid', gap: 18 }}>
                {error && <p role="alert" style={{ color: 'var(--color-err)' }}>{error}</p>}
                <InvoiceFields values={fields} errors={errors} disabled={false} onChange={change} />

                <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
                    <legend style={{ marginBottom: 8 }}>Moradores</legend>
                    {loadError ? (
                        <div role="alert" style={{ color: 'var(--color-err)' }}>
                            <p>{loadError}</p>
                            <button type="button" className="btn-ghost" onClick={retry}>Tentar novamente</button>
                        </div>
                    ) : loading ? <p role="status">Carregando moradores...</p> : (
                        <>
                            <input className="luxe-input" aria-label="Buscar morador" placeholder="Buscar por nome ou unidade"
                                value={search} onChange={event => setSearch(event.target.value)} />
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
                                <button type="button" className="btn-ghost" onClick={selectVisible} disabled={!visible.length || atLimit}>Selecionar os listados</button>
                                <button type="button" className="btn-ghost" onClick={() => setSelected(new Set())} disabled={!selected.size}>Limpar seleção</button>
                                <span role="status" style={{ color: 'var(--color-bone-muted)' }}>
                                    {selected.size} de {eligible.length} selecionados (máximo {MAX_BATCH_SIZE} por lote)
                                </span>
                            </div>
                            <div role="group" aria-label="Lista de moradores"
                                style={{ maxHeight: 240, overflow: 'auto', border: '1px solid var(--color-line)' }}>
                                {visible.length === 0 ? (
                                    <p style={{ padding: 16, color: 'var(--color-bone-muted)' }}>Nenhum morador encontrado.</p>
                                ) : visible.map(user => (
                                    <label key={user.id} style={rowStyle}>
                                        <input type="checkbox" checked={selected.has(user.id)}
                                            disabled={!selected.has(user.id) && atLimit} onChange={() => toggle(user.id)} />
                                        <span>{user.name}</span>
                                        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-bone-muted)' }}>{formatUnitDisplay(user.unit)}</span>
                                    </label>
                                ))}
                            </div>
                            {atLimit && <p role="note" style={{ fontSize: 12, color: 'var(--color-warn)' }}>Limite de {MAX_BATCH_SIZE} moradores atingido. Emita este lote e faça outro para os demais.</p>}
                            <BlockedResidents blocked={blocked} />
                        </>
                    )}
                </fieldset>

                <LuxuryModalFooter onCancel={onClose} submitLabel="Revisar emissão" isSubmitting={false} />
            </form>
        </LuxuryModal>
    );
}
