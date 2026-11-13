import type { DraftErrors, DraftFields } from '../../lib/invoiceForm';
import { INVOICE_TYPE_LABELS, type InvoiceType } from '../../types/invoice';

interface Props {
    values: DraftFields;
    errors: DraftErrors;
    disabled: boolean;
    onChange: (patch: Partial<DraftFields>) => void;
}

function FieldError({ text }: { text?: string }) {
    if (!text) return null;
    return <small role="alert" style={{ color: 'var(--color-err)', display: 'block', marginTop: 4 }}>{text}</small>;
}

/** Campos comuns da emissão individual e em lote. */
export default function InvoiceFields({ values, errors, disabled, onChange }: Props) {
    return (
        <div style={{ display: 'grid', gap: 18 }}>
            <label>Tipo
                <select className="luxe-input" value={values.type} disabled={disabled}
                    onChange={event => onChange({ type: event.target.value as InvoiceType })}>
                    {Object.entries(INVOICE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
            </label>
            <label>Descrição
                <input className="luxe-input" maxLength={191} placeholder="Ex.: Taxa condominial 11/2026"
                    value={values.description} disabled={disabled} aria-invalid={!!errors.description}
                    onChange={event => onChange({ description: event.target.value })} />
                <FieldError text={errors.description} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
                <label>Valor (R$)
                    <input className="luxe-input" inputMode="decimal" placeholder="350,00"
                        value={values.amount} disabled={disabled} aria-invalid={!!errors.amount}
                        onChange={event => onChange({ amount: event.target.value })} />
                    <FieldError text={errors.amount} />
                </label>
                <label>Vencimento
                    <input className="luxe-input" type="date" min="2000-01-01" max="9998-12-31"
                        value={values.dueDate} disabled={disabled} aria-invalid={!!errors.dueDate}
                        onChange={event => onChange({ dueDate: event.target.value })} />
                    <FieldError text={errors.dueDate} />
                </label>
                <label>Mês de referência (opcional)
                    <input className="luxe-input" type="month" placeholder="AAAA-MM"
                        value={values.referenceMonth} disabled={disabled} aria-invalid={!!errors.referenceMonth}
                        onChange={event => onChange({ referenceMonth: event.target.value })} />
                    <FieldError text={errors.referenceMonth} />
                </label>
            </div>
        </div>
    );
}
