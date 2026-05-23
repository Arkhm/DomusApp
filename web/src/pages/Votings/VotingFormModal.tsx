import { useState, useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';
import { Vote, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { votingService } from '../../services/votingService';
import type { VotingFormData } from '../../types/voting';
import LuxuryModal, { LuxuryModalFooter } from '../../components/luxury/LuxuryModal';

// ---- Date/time helpers (24h, DD/MM/AAAA, per-field) ------------------------
// Mirrored from EventFormModal: 5 independent segments (DD / MM / AAAA - HH : MM)
// so the user can edit any segment without disturbing the others.

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
        if (first === '0') return '123456789'.includes(d);
        if (first === '1' || first === '2') return /\d/.test(d);
        if (first === '3') return '01'.includes(d);
        return false;
    });
}

function maskMonth(input: string): string {
    return filterDigits(input, 2, (d, prior) => {
        if (prior.length === 0) return '01'.includes(d);
        const first = prior[0];
        if (first === '0') return '123456789'.includes(d);
        if (first === '1') return '012'.includes(d);
        return false;
    });
}

function maskYear(input: string): string {
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
        if (first === '2') return '0123'.includes(d);
        return false;
    });
}

function maskMinute(input: string): string {
    return filterDigits(input, 2, (d, prior) => {
        if (prior.length === 0) return '012345'.includes(d);
        return /\d/.test(d);
    });
}

function isValidBrDateParts(dd: string, mm: string, yyyy: string): boolean {
    if (dd.length !== 2 || mm.length !== 2 || yyyy.length !== 4) return false;
    const day = +dd,
        month = +mm,
        year = +yyyy;
    if (year < 1900 || year > 2099) return false;
    const dt = new Date(year, month - 1, day);
    return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day;
}

interface DateState {
    day: string;
    month: string;
    year: string;
    hour: string;
    minute: string;
}

function buildIso(s: DateState): string {
    const dateOk = isValidBrDateParts(s.day, s.month, s.year);
    const timeOk = s.hour.length === 2 && s.minute.length === 2;
    if (!dateOk || !timeOk) return '';
    // Construir Date em hora LOCAL e serializar como UTC ISO — mesmo padrão do
    // EventFormModal. Antes era string ISO naïve (sem TZ) que o backend
    // interpretava como UTC, deslocando a hora exibida em BRT.
    const local = new Date(+s.year, +s.month - 1, +s.day, +s.hour, +s.minute, 0, 0);
    return local.toISOString();
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const MIN_OPTIONS = 2;

export default function VotingFormModal({ isOpen, onClose, onSuccess }: Props) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [options, setOptions] = useState<string[]>(['', '']);
    const [showErrors, setShowErrors] = useState(false);

    const [start, setStart] = useState<DateState>({ day: '', month: '', year: '', hour: '', minute: '' });
    const [end, setEnd] = useState<DateState>({ day: '', month: '', year: '', hour: '', minute: '' });

    const startDayRef = useRef<HTMLInputElement>(null);
    const startMonthRef = useRef<HTMLInputElement>(null);
    const startYearRef = useRef<HTMLInputElement>(null);
    const startHourRef = useRef<HTMLInputElement>(null);
    const startMinuteRef = useRef<HTMLInputElement>(null);

    const endDayRef = useRef<HTMLInputElement>(null);
    const endMonthRef = useRef<HTMLInputElement>(null);
    const endYearRef = useRef<HTMLInputElement>(null);
    const endHourRef = useRef<HTMLInputElement>(null);
    const endMinuteRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setTitle('');
            setDescription('');
            setOptions(['', '']);
            setStart({ day: '', month: '', year: '', hour: '', minute: '' });
            setEnd({ day: '', month: '', year: '', hour: '', minute: '' });
            setShowErrors(false);
        }
    }, [isOpen]);

    const advanceIfFull = (value: string, max: number, next: RefObject<HTMLInputElement | null>) => {
        if (value.length === max) next.current?.focus();
    };

    const backspaceToPrev = (
        value: string,
        prev: RefObject<HTMLInputElement | null>,
    ) => (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && value === '' && prev.current) {
            e.preventDefault();
            prev.current.focus();
            const v = prev.current.value;
            prev.current.setSelectionRange(v.length, v.length);
        }
    };

    const startDateComplete = start.day.length === 2 && start.month.length === 2 && start.year.length === 4;
    const endDateComplete = end.day.length === 2 && end.month.length === 2 && end.year.length === 4;

    const startDateError =
        startDateComplete && !isValidBrDateParts(start.day, start.month, start.year)
            ? 'Data inexistente no calendário.'
            : '';
    const endDateError =
        endDateComplete && !isValidBrDateParts(end.day, end.month, end.year)
            ? 'Data inexistente no calendário.'
            : '';

    const startIso = buildIso(start);
    const endIso = buildIso(end);

    const rangeError =
        startIso && endIso && new Date(endIso).getTime() < new Date(startIso).getTime()
            ? 'A data de término deve ser igual ou posterior à data de início.'
            : '';

    const updateOption = (idx: number, value: string) => {
        setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
    };

    const addOption = () => {
        setOptions((prev) => [...prev, '']);
    };

    const removeOption = (idx: number) => {
        if (options.length <= MIN_OPTIONS) return;
        setOptions((prev) => prev.filter((_, i) => i !== idx));
    };

    const filledOptions = options.map((o) => o.trim()).filter(Boolean);
    const hasEmptyOption = options.some((o) => !o.trim());

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setShowErrors(true);

        if (!title.trim() || !description.trim()) {
            toast.error('Título e descrição são obrigatórios.');
            return;
        }

        if (!startDateComplete || start.hour.length !== 2 || start.minute.length !== 2 || !startIso) {
            toast.error('Informe a data de início completa.');
            return;
        }
        if (startDateError) {
            toast.error(startDateError);
            return;
        }

        if (!endDateComplete || end.hour.length !== 2 || end.minute.length !== 2 || !endIso) {
            toast.error('Informe a data de término completa.');
            return;
        }
        if (endDateError) {
            toast.error(endDateError);
            return;
        }

        if (rangeError) {
            toast.error(rangeError);
            return;
        }

        if (filledOptions.length < MIN_OPTIONS) {
            toast.error('Informe pelo menos 2 opções de voto.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload: VotingFormData = {
                title: title.trim(),
                description: description.trim(),
                startDate: startIso,
                endDate: endIso,
                options: filledOptions,
            };
            await votingService.create(payload);
            toast.success('Votação criada com sucesso!');
            onSuccess();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao criar votação.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <LuxuryModal
            open={isOpen}
            onClose={onClose}
            busy={isSubmitting}
            icon={<Vote size={18} strokeWidth={1.4} />}
            title="Nova Votação"
            subtitle="Submeta uma deliberação à comunidade"
            size="xl"
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
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ex: Reforma da fachada do bloco A"
                                    className="w-full px-4 py-2.5 rounded-xl bg-bg-secondary border border-border-primary text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 text-sm transition-colors"
                                />
                            </div>

                            {/* Descrição */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                    Descrição <span className="text-error">*</span>
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={4}
                                    placeholder="Contextualize a deliberação para os moradores..."
                                    className="w-full px-4 py-2.5 rounded-xl bg-bg-secondary border border-border-primary text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 text-sm transition-colors resize-none"
                                />
                            </div>

                            {/* Opções de voto */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-text-secondary">
                                        Opções de Voto <span className="text-error">*</span>
                                    </label>
                                    <span className="text-[11px] text-text-muted">
                                        mínimo {MIN_OPTIONS}
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {options.map((opt, i) => {
                                        const empty = showErrors && !opt.trim();
                                        return (
                                            <div key={i} className="flex items-center gap-2">
                                                <span
                                                    className="tracking-luxe"
                                                    style={{
                                                        fontSize: 10,
                                                        color: 'var(--color-bone-muted)',
                                                        minWidth: 60,
                                                    }}
                                                >
                                                    Opção {i + 1}
                                                </span>
                                                <input
                                                    type="text"
                                                    value={opt}
                                                    onChange={(e) => updateOption(i, e.target.value)}
                                                    placeholder={`Ex: ${i === 0 ? 'A favor' : i === 1 ? 'Contra' : 'Abstenção'}`}
                                                    className={`flex-1 px-4 py-2 rounded-xl bg-bg-secondary border text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 text-sm transition-colors ${
                                                        empty
                                                            ? 'border-error focus:border-error focus:ring-error/30'
                                                            : 'border-border-primary focus:border-accent-primary focus:ring-accent-primary/30'
                                                    }`}
                                                />
                                                {options.length > MIN_OPTIONS && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeOption(i)}
                                                        title="Remover opção"
                                                        className="p-2 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                {showErrors && hasEmptyOption && (
                                    <p className="mt-1.5 text-[11px] text-error">
                                        Preencha todas as opções ou remova as vazias.
                                    </p>
                                )}
                                <button
                                    type="button"
                                    onClick={addOption}
                                    className="mt-3 inline-flex items-center gap-1.5 text-xs text-accent-primary hover:underline"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Adicionar Opção
                                </button>
                            </div>

                            {/* Datas — início e término lado a lado */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <DateTimePicker
                                    label="Data de Início"
                                    state={start}
                                    setState={setStart}
                                    refs={{
                                        day: startDayRef,
                                        month: startMonthRef,
                                        year: startYearRef,
                                        hour: startHourRef,
                                        minute: startMinuteRef,
                                    }}
                                    advanceIfFull={advanceIfFull}
                                    backspaceToPrev={backspaceToPrev}
                                    dateError={startDateError}
                                />
                                <DateTimePicker
                                    label="Data de Término"
                                    state={end}
                                    setState={setEnd}
                                    refs={{
                                        day: endDayRef,
                                        month: endMonthRef,
                                        year: endYearRef,
                                        hour: endHourRef,
                                        minute: endMinuteRef,
                                    }}
                                    advanceIfFull={advanceIfFull}
                                    backspaceToPrev={backspaceToPrev}
                                    dateError={endDateError}
                                />
                            </div>
                            {rangeError && (
                                <p className="text-[11px] text-error -mt-2">{rangeError}</p>
                            )}

                            <LuxuryModalFooter
                                onCancel={onClose}
                                submitLabel="Criar votação"
                                loadingLabel="Criando…"
                                isSubmitting={isSubmitting}
                            />
                        </form>
        </LuxuryModal>
    );
}

// ---------- Date/time picker block ------------------------------------------

interface DateTimePickerProps {
    label: string;
    state: DateState;
    setState: React.Dispatch<React.SetStateAction<DateState>>;
    refs: {
        day: RefObject<HTMLInputElement | null>;
        month: RefObject<HTMLInputElement | null>;
        year: RefObject<HTMLInputElement | null>;
        hour: RefObject<HTMLInputElement | null>;
        minute: RefObject<HTMLInputElement | null>;
    };
    advanceIfFull: (v: string, max: number, next: RefObject<HTMLInputElement | null>) => void;
    backspaceToPrev: (
        v: string,
        prev: RefObject<HTMLInputElement | null>,
    ) => (e: KeyboardEvent<HTMLInputElement>) => void;
    dateError: string;
}

function DateTimePicker({
    label,
    state,
    setState,
    refs,
    advanceIfFull,
    backspaceToPrev,
    dateError,
}: DateTimePickerProps) {
    const update = (field: keyof DateState, value: string) => {
        setState((prev) => ({ ...prev, [field]: value }));
    };

    return (
        <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
                {label} <span className="text-error">*</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
                <div
                    className={`flex items-center bg-bg-secondary border rounded-xl px-2 py-1 transition-colors focus-within:ring-1 ${
                        dateError
                            ? 'border-error focus-within:border-error focus-within:ring-error/30'
                            : 'border-border-primary focus-within:border-accent-primary focus-within:ring-accent-primary/30'
                    }`}
                >
                    <Segment
                        ref={refs.day}
                        value={state.day}
                        onChange={(v) => {
                            const m = maskDay(v);
                            update('day', m);
                            advanceIfFull(m, 2, refs.month);
                        }}
                        placeholder="DD"
                        width={28}
                        ariaLabel="Dia"
                        ariaInvalid={!!dateError}
                    />
                    <Sep>/</Sep>
                    <Segment
                        ref={refs.month}
                        value={state.month}
                        onChange={(v) => {
                            const m = maskMonth(v);
                            update('month', m);
                            advanceIfFull(m, 2, refs.year);
                        }}
                        onKeyDown={backspaceToPrev(state.month, refs.day)}
                        placeholder="MM"
                        width={28}
                        ariaLabel="Mês"
                        ariaInvalid={!!dateError}
                    />
                    <Sep>/</Sep>
                    <Segment
                        ref={refs.year}
                        value={state.year}
                        onChange={(v) => {
                            const m = maskYear(v);
                            update('year', m);
                            advanceIfFull(m, 4, refs.hour);
                        }}
                        onKeyDown={backspaceToPrev(state.year, refs.month)}
                        placeholder="AAAA"
                        width={52}
                        ariaLabel="Ano"
                        ariaInvalid={!!dateError}
                    />
                </div>
                <div className="flex items-center bg-bg-secondary border border-border-primary rounded-xl px-2 py-1 transition-colors focus-within:border-accent-primary focus-within:ring-1 focus-within:ring-accent-primary/30">
                    <Segment
                        ref={refs.hour}
                        value={state.hour}
                        onChange={(v) => {
                            const m = maskHour(v);
                            update('hour', m);
                            advanceIfFull(m, 2, refs.minute);
                        }}
                        onKeyDown={backspaceToPrev(state.hour, refs.year)}
                        placeholder="HH"
                        width={28}
                        ariaLabel="Hora"
                    />
                    <Sep>:</Sep>
                    <Segment
                        ref={refs.minute}
                        value={state.minute}
                        onChange={(v) => update('minute', maskMinute(v))}
                        onKeyDown={backspaceToPrev(state.minute, refs.hour)}
                        placeholder="MM"
                        width={28}
                        ariaLabel="Minuto"
                    />
                </div>
            </div>
            {dateError ? (
                <p className="mt-1.5 text-[11px] text-error">{dateError}</p>
            ) : (
                <p className="mt-1.5 text-[11px] text-text-muted">
                    Formato 24h. Ex.: 23/05/2026 19:30.
                </p>
            )}
        </div>
    );
}

// ---------- Segment input ---------------------------------------------------

interface SegmentProps {
    value: string;
    onChange: (v: string) => void;
    onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
    placeholder: string;
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
