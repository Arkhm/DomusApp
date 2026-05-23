import { useState, useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';
import { motion } from 'motion/react';
import { CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';
import { eventService } from '../../services/eventService';
import { unitService } from '../../services/unitService';
import {
    EVENT_CATEGORY_LABEL,
    EVENT_STATUS_LABEL,
    type EventCategory,
    type EventFormData,
    type EventStatus,
} from '../../types/event';
import type { Unit } from '../../types/user';
import { formatUnitDisplay } from '../../types/user';
import LuxuryModal, { LuxuryModalFooter } from '../../components/luxury/LuxuryModal';

// ---- Date/time helpers (24h, DD/MM/AAAA, per-field) ------------------------
// We split the date/time into 5 independent inputs (DD / MM / AAAA — HH : MM)
// so the user can edit any segment without disturbing the others. Each mask
// filters digit-by-digit against the position rules: invalid characters are
// dropped at the source ("99/99/9999" is unreachable).

function filterDigits(input: string, max: number, validate: (d: string, prior: string) => boolean): string {
    const digits = input.replace(/\D/g, '');
    let result = '';
    for (const d of digits) {
        if (result.length >= max) break;
        if (!validate(d, result)) break;
        result += d;
    }
    return result;
}

function maskDay(input: string): string {
    return filterDigits(input, 2, (d, prior) => {
        if (prior.length === 0) return '0123'.includes(d);
        const first = prior[0];
        if (first === '0') return '123456789'.includes(d); // proíbe 00
        if (first === '1' || first === '2') return /\d/.test(d);
        if (first === '3') return '01'.includes(d); // 30, 31
        return false;
    });
}

function maskMonth(input: string): string {
    return filterDigits(input, 2, (d, prior) => {
        if (prior.length === 0) return '01'.includes(d);
        const first = prior[0];
        if (first === '0') return '123456789'.includes(d); // 01–09
        if (first === '1') return '012'.includes(d); // 10, 11, 12
        return false;
    });
}

function maskYear(input: string): string {
    // Permite 1xxx ou 2xxx; outros dígitos no resto do ano são livres.
    return filterDigits(input, 4, (d, prior) => {
        if (prior.length === 0) return '12'.includes(d);
        return /\d/.test(d);
    });
}

function maskHour(input: string): string {
    return filterDigits(input, 2, (d, prior) => {
        if (prior.length === 0) return '012'.includes(d);
        const first = prior[0];
        if (first === '0' || first === '1') return /\d/.test(d);
        if (first === '2') return '0123'.includes(d); // 20–23
        return false;
    });
}

function maskMinute(input: string): string {
    return filterDigits(input, 2, (d, prior) => {
        if (prior.length === 0) return '012345'.includes(d);
        return /\d/.test(d);
    });
}

/**
 * Check that the trio dd/mm/yyyy lines up with a real calendar date.
 * Catches 31/02, 29/02 em anos não-bissextos, 31/04, etc.
 */
function isValidBrDateParts(dd: string, mm: string, yyyy: string): boolean {
    if (dd.length !== 2 || mm.length !== 2 || yyyy.length !== 4) return false;
    const day = +dd,
        month = +mm,
        year = +yyyy;
    if (year < 1900 || year > 2099) return false;
    const dt = new Date(year, month - 1, day);
    return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function EventFormModal({ isOpen, onClose, onSuccess }: Props) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [units, setUnits] = useState<Unit[]>([]);

    // Five independent inputs so edits to one segment don't ripple into the others.
    const [day, setDay] = useState('');
    const [month, setMonth] = useState('');
    const [year, setYear] = useState('');
    const [hour, setHour] = useState('');
    const [minute, setMinute] = useState('');

    const dayRef = useRef<HTMLInputElement>(null);
    const monthRef = useRef<HTMLInputElement>(null);
    const yearRef = useRef<HTMLInputElement>(null);
    const hourRef = useRef<HTMLInputElement>(null);
    const minuteRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState<EventFormData>({
        title: '',
        content: '',
        eventDate: '',
        location: '',
        targetType: 'ALL',
        targetUnitId: undefined,
        category: 'OUTRO',
        capacity: null,
        status: 'PUBLISHED',
    });

    useEffect(() => {
        if (isOpen) {
            setForm({
                title: '',
                content: '',
                eventDate: '',
                location: '',
                targetType: 'ALL',
                targetUnitId: undefined,
                category: 'OUTRO',
                capacity: null,
                status: 'PUBLISHED',
            });
            setDay('');
            setMonth('');
            setYear('');
            setHour('');
            setMinute('');
            unitService.getAll().then(setUnits).catch(() => {});
        }
    }, [isOpen]);

    // Derive form.eventDate from the 5 segments whenever any changes.
    // Build a Date in **local time** (admin's timezone) and serialize to UTC ISO
    // so the backend stores the actual moment, not a naive timestamp interpreted
    // as UTC (which would shift the displayed hour for users in BRT/BRST).
    useEffect(() => {
        const dateOk = isValidBrDateParts(day, month, year);
        const timeOk = hour.length === 2 && minute.length === 2;
        let iso = '';
        if (dateOk && timeOk) {
            const local = new Date(+year, +month - 1, +day, +hour, +minute, 0, 0);
            iso = local.toISOString();
        }
        setForm((prev) => (prev.eventDate === iso ? prev : { ...prev, eventDate: iso }));
    }, [day, month, year, hour, minute]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    // Helper: when a segment hits its max length, jump focus to the next field.
    const advanceIfFull = (value: string, max: number, next: RefObject<HTMLInputElement | null>) => {
        if (value.length === max) next.current?.focus();
    };

    // Helper: pressing Backspace on an empty segment jumps back to the previous.
    const backspaceToPrev = (
        value: string,
        prev: RefObject<HTMLInputElement | null>,
    ) => (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && value === '' && prev.current) {
            e.preventDefault();
            prev.current.focus();
            // Place cursor at the end so the next Backspace deletes a char.
            const v = prev.current.value;
            prev.current.setSelectionRange(v.length, v.length);
        }
    };

    // Inline calendar error — only shown when all 3 date parts are complete
    // but produce an impossible date (31/02, 29/02 não-bissexto, 31/04, …).
    const dateComplete = day.length === 2 && month.length === 2 && year.length === 4;
    const dateError = (() => {
        if (!dateComplete) return '';
        if (!isValidBrDateParts(day, month, year)) {
            return 'Data inexistente no calendário (verifique os dias do mês).';
        }
        // If the time is also set, reject moments in the past — events should be future.
        if (hour.length === 2 && minute.length === 2) {
            const candidate = new Date(+year, +month - 1, +day, +hour, +minute, 0, 0);
            if (candidate.getTime() <= Date.now()) {
                return 'A data do evento deve ser futura.';
            }
        }
        return '';
    })();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.title.trim() || !form.content.trim()) {
            toast.error('Título e descrição são obrigatórios.');
            return;
        }

        if (!dateComplete) {
            toast.error('Informe a data completa (DD/MM/AAAA).');
            return;
        }

        if (dateError) {
            toast.error(dateError);
            return;
        }

        if (hour.length !== 2 || minute.length !== 2) {
            toast.error('Informe a hora completa (HH:MM, 24h).');
            return;
        }

        if (!form.eventDate) {
            toast.error('Data ou hora inválida. Use DD/MM/AAAA e HH:MM (24h).');
            return;
        }

        if (form.targetType === 'UNIT' && !form.targetUnitId) {
            toast.error('Selecione uma unidade de destino.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload: EventFormData = {
                title: form.title.trim(),
                content: form.content.trim(),
                eventDate: form.eventDate,
                targetType: form.targetType,
                category: form.category || 'OUTRO',
                status: form.status || 'PUBLISHED',
                capacity: form.capacity ?? null,
            };

            if (form.location?.trim()) {
                payload.location = form.location.trim();
            }

            if (form.targetType === 'UNIT') {
                payload.targetUnitId = form.targetUnitId;
            }

            await eventService.create(payload);
            toast.success('Evento criado com sucesso!');
            onSuccess();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao criar evento.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <LuxuryModal
            open={isOpen}
            onClose={onClose}
            busy={isSubmitting}
            icon={<CalendarDays size={18} strokeWidth={1.4} />}
            title="Novo Evento"
            subtitle="Crie um evento para o condomínio"
            size="lg"
        >
                        {/* Form */}
                        <form onSubmit={handleSubmit} style={{ padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                            {/* Título */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                    Título <span className="text-error">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="title"
                                    value={form.title}
                                    onChange={handleChange}
                                    placeholder="Ex: Festa Junina do Condomínio"
                                    className="w-full px-4 py-2.5 rounded-xl bg-bg-secondary border border-border-primary text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 text-sm transition-colors"
                                />
                            </div>

                            {/* Conteúdo */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                    Descrição <span className="text-error">*</span>
                                </label>
                                <textarea
                                    name="content"
                                    value={form.content}
                                    onChange={handleChange}
                                    rows={4}
                                    placeholder="Descreva os detalhes do evento..."
                                    className="w-full px-4 py-2.5 rounded-xl bg-bg-secondary border border-border-primary text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 text-sm transition-colors resize-none"
                                />
                            </div>

                            {/* Data e Hora — 5 segmentos independentes */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                    Data e Hora <span className="text-error">*</span>
                                </label>
                                <div className="flex flex-wrap items-center gap-3">
                                    {/* DD / MM / AAAA */}
                                    <div
                                        className={`flex items-center bg-bg-secondary border rounded-xl px-2 py-1 transition-colors focus-within:ring-1 ${
                                            dateError
                                                ? 'border-error focus-within:border-error focus-within:ring-error/30'
                                                : 'border-border-primary focus-within:border-accent-primary focus-within:ring-accent-primary/30'
                                        }`}
                                    >
                                        <Segment
                                            ref={dayRef}
                                            value={day}
                                            onChange={(v) => {
                                                const masked = maskDay(v);
                                                setDay(masked);
                                                advanceIfFull(masked, 2, monthRef);
                                            }}
                                            placeholder="DD"
                                            width={28}
                                            ariaLabel="Dia"
                                            ariaInvalid={!!dateError}
                                        />
                                        <Sep>/</Sep>
                                        <Segment
                                            ref={monthRef}
                                            value={month}
                                            onChange={(v) => {
                                                const masked = maskMonth(v);
                                                setMonth(masked);
                                                advanceIfFull(masked, 2, yearRef);
                                            }}
                                            onKeyDown={backspaceToPrev(month, dayRef)}
                                            placeholder="MM"
                                            width={28}
                                            ariaLabel="Mês"
                                            ariaInvalid={!!dateError}
                                        />
                                        <Sep>/</Sep>
                                        <Segment
                                            ref={yearRef}
                                            value={year}
                                            onChange={(v) => {
                                                const masked = maskYear(v);
                                                setYear(masked);
                                                advanceIfFull(masked, 4, hourRef);
                                            }}
                                            onKeyDown={backspaceToPrev(year, monthRef)}
                                            placeholder="AAAA"
                                            width={52}
                                            ariaLabel="Ano"
                                            ariaInvalid={!!dateError}
                                        />
                                    </div>

                                    {/* HH : MM */}
                                    <div className="flex items-center bg-bg-secondary border border-border-primary rounded-xl px-2 py-1 transition-colors focus-within:border-accent-primary focus-within:ring-1 focus-within:ring-accent-primary/30">
                                        <Segment
                                            ref={hourRef}
                                            value={hour}
                                            onChange={(v) => {
                                                const masked = maskHour(v);
                                                setHour(masked);
                                                advanceIfFull(masked, 2, minuteRef);
                                            }}
                                            onKeyDown={backspaceToPrev(hour, yearRef)}
                                            placeholder="HH"
                                            width={28}
                                            ariaLabel="Hora"
                                        />
                                        <Sep>:</Sep>
                                        <Segment
                                            ref={minuteRef}
                                            value={minute}
                                            onChange={(v) => setMinute(maskMinute(v))}
                                            onKeyDown={backspaceToPrev(minute, hourRef)}
                                            placeholder="MM"
                                            width={28}
                                            ariaLabel="Minuto"
                                        />
                                    </div>
                                </div>
                                {dateError ? (
                                    <p
                                        id="event-date-error"
                                        className="mt-1.5 text-[11px] text-error"
                                    >
                                        {dateError}
                                    </p>
                                ) : (
                                    <p
                                        id="event-date-hint"
                                        className="mt-1.5 text-[11px] text-text-muted"
                                    >
                                        Formato 24h. Ex.: 23/05/2026 19:30.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                    Local
                                </label>
                                <input
                                    type="text"
                                    name="location"
                                    value={form.location}
                                    onChange={handleChange}
                                    placeholder="Ex: Salão de festas"
                                    className="w-full px-4 py-2.5 rounded-xl bg-bg-secondary border border-border-primary text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 text-sm transition-colors"
                                />
                            </div>

                            {/* Categoria + Capacidade */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                        Categoria
                                    </label>
                                    <select
                                        name="category"
                                        value={form.category || 'OUTRO'}
                                        onChange={(e) =>
                                            setForm((p) => ({ ...p, category: e.target.value as EventCategory }))
                                        }
                                        className="w-full px-4 py-2.5 rounded-xl bg-bg-secondary border border-border-primary text-text-primary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 text-sm transition-colors"
                                    >
                                        {(Object.keys(EVENT_CATEGORY_LABEL) as EventCategory[]).map((c) => (
                                            <option key={c} value={c}>
                                                {EVENT_CATEGORY_LABEL[c]}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                        Capacidade <span className="text-text-muted">(opcional)</span>
                                    </label>
                                    <input
                                        type="number"
                                        name="capacity"
                                        min={1}
                                        value={form.capacity ?? ''}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setForm((p) => ({
                                                ...p,
                                                capacity: v === '' ? null : Math.max(1, Number(v)),
                                            }));
                                        }}
                                        placeholder="Sem limite"
                                        className="w-full px-4 py-2.5 rounded-xl bg-bg-secondary border border-border-primary text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 text-sm transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Status */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                    Status
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(Object.keys(EVENT_STATUS_LABEL) as EventStatus[]).map((s) => {
                                        const active = (form.status || 'PUBLISHED') === s;
                                        return (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => setForm((p) => ({ ...p, status: s }))}
                                                style={{
                                                    padding: '10px 12px',
                                                    fontSize: 12,
                                                    background: active
                                                        ? 'color-mix(in srgb, var(--color-metal-1) 8%, transparent)'
                                                        : 'var(--color-ink-1)',
                                                    border: `1px solid ${
                                                        active
                                                            ? 'var(--color-metal-1)'
                                                            : 'var(--color-line-strong)'
                                                    }`,
                                                    color: active
                                                        ? 'var(--color-metal-1)'
                                                        : 'var(--color-bone)',
                                                    borderRadius: 3,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    fontFamily: 'var(--font-sans)',
                                                }}
                                            >
                                                {EVENT_STATUS_LABEL[s]}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Público-alvo */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                    Público-alvo
                                </label>
                                <select
                                    name="targetType"
                                    value={form.targetType}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 rounded-xl bg-bg-secondary border border-border-primary text-text-primary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 text-sm transition-colors"
                                >
                                    <option value="ALL">Todos os moradores</option>
                                    <option value="UNIT">Unidade específica</option>
                                </select>
                            </div>

                            {/* Seleção de unidade */}
                            {form.targetType === 'UNIT' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                >
                                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                        Unidade <span className="text-error">*</span>
                                    </label>
                                    <select
                                        name="targetUnitId"
                                        value={form.targetUnitId || ''}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 rounded-xl bg-bg-secondary border border-border-primary text-text-primary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 text-sm transition-colors"
                                    >
                                        <option value="">Selecione uma unidade</option>
                                        {units.map((unit) => (
                                            <option key={unit.id} value={unit.id}>
                                                {formatUnitDisplay(unit)}
                                            </option>
                                        ))}
                                    </select>
                                </motion.div>
                            )}

                            <LuxuryModalFooter
                                onCancel={onClose}
                                submitLabel="Criar evento"
                                loadingLabel="Criando…"
                                isSubmitting={isSubmitting}
                            />
                        </form>
        </LuxuryModal>
    );
}

// ---- Inline segment input + visual separator ------------------------------

interface SegmentProps {
    value: string;
    onChange: (v: string) => void;
    onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
    placeholder: string;
    /** Pixel width — DD/MM/HH/MM = 28, AAAA = 52 */
    width: number;
    ariaLabel: string;
    ariaInvalid?: boolean;
}

const Segment = function Segment({
    value,
    onChange,
    onKeyDown,
    placeholder,
    width,
    ariaLabel,
    ariaInvalid,
    ref,
}: SegmentProps & { ref?: RefObject<HTMLInputElement | null> }) {
    return (
        <input
            ref={ref}
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={(e) => e.currentTarget.select()}
            placeholder={placeholder}
            aria-label={ariaLabel}
            aria-invalid={ariaInvalid}
            style={{ width }}
            className="bg-transparent text-center py-1.5 outline-none font-mono tabular-nums text-sm text-text-primary placeholder-text-muted"
        />
    );
};

function Sep({ children }: { children: string }) {
    return <span className="px-0.5 text-text-muted font-mono select-none">{children}</span>;
}
