import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';
import { eventService } from '../../services/eventService';
import { unitService } from '../../services/unitService';
import type { EventFormData } from '../../types/event';
import type { Unit } from '../../types/user';

// ---- Date/time helpers (24h, DD/MM/AAAA) -----------------------------------
// Chrome ignores `lang` on <input type="datetime-local"> and always uses the
// browser/OS locale, so we hand-roll two masked text inputs to guarantee
// Brazilian format regardless of where the admin's machine is configured.
//
// Both masks filter digit-by-digit: only digits that can still form a valid
// date/time at their position are accepted, so "99/99/9999" can never even be
// typed — the rogue 9 is dropped at the source.

/**
 * Returns true if `digit` is a legal character for position `prior.length`
 * given the digits already accepted (e.g. day position 1 depends on day
 * position 0: if "3" was typed, only "0" or "1" come next).
 */
function isValidDateDigit(digit: string, prior: string): boolean {
    const pos = prior.length;
    switch (pos) {
        case 0: // D1: 0,1,2,3
            return '0123'.includes(digit);
        case 1: {
            // D2: depends on D1 — 0X (1-9), 1X/2X (0-9), 3X (0,1 → 30, 31)
            const d1 = prior[0];
            if (d1 === '0') return '123456789'.includes(digit);
            if (d1 === '1' || d1 === '2') return /\d/.test(digit);
            if (d1 === '3') return '01'.includes(digit);
            return false;
        }
        case 2: // M1: 0 or 1
            return '01'.includes(digit);
        case 3: {
            // M2: depends on M1 — 0X (1-9), 1X (0,1,2 → 10, 11, 12)
            const m1 = prior[2];
            if (m1 === '0') return '123456789'.includes(digit);
            if (m1 === '1') return '012'.includes(digit);
            return false;
        }
        case 4: // Y1: 1 or 2 (anos 1xxx ou 2xxx)
            return '12'.includes(digit);
        case 5:
        case 6:
        case 7:
            return /\d/.test(digit);
        default:
            return false;
    }
}

function isValidTimeDigit(digit: string, prior: string): boolean {
    const pos = prior.length;
    switch (pos) {
        case 0: // H1: 0, 1 ou 2
            return '012'.includes(digit);
        case 1: {
            // H2: depends on H1 — 0X/1X (0-9), 2X (0,1,2,3 → 20-23)
            const h1 = prior[0];
            if (h1 === '0' || h1 === '1') return /\d/.test(digit);
            if (h1 === '2') return '0123'.includes(digit);
            return false;
        }
        case 2: // M1: 0-5
            return '012345'.includes(digit);
        case 3:
            return /\d/.test(digit);
        default:
            return false;
    }
}

/**
 * Filter raw input one digit at a time. As soon as an invalid digit appears
 * at its position, we stop accepting — anything after it would be in the
 * wrong slot anyway.
 */
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

function maskDate(input: string): string {
    const digits = filterDigits(input, 8, isValidDateDigit);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function maskTime(input: string): string {
    const digits = filterDigits(input, 4, isValidTimeDigit);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/**
 * Combine BR date + 24h time into the ISO format the backend expects.
 * Returns '' when either piece is missing/invalid so the parent's required
 * check on form.eventDate still works.
 */
function brToIso(date: string, time: string): string {
    const d = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const t = time.match(/^(\d{2}):(\d{2})$/);
    if (!d || !t) return '';
    const [, dd, mm, yyyy] = d;
    const [, hh, mi] = t;
    const day = +dd,
        month = +mm,
        year = +yyyy,
        hour = +hh,
        minute = +mi;
    if (month < 1 || month > 12 || day < 1 || day > 31) return '';
    if (year < 1900 || year > 2099) return '';
    if (hour > 23 || minute > 59) return '';
    // Verify it's a real calendar date (catches 31/02, 31/04 etc.)
    const dt = new Date(year, month - 1, day, hour, minute);
    if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return '';
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function EventFormModal({ isOpen, onClose, onSuccess }: Props) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [units, setUnits] = useState<Unit[]>([]);

    // Date/time are kept as displayed BR strings and combined into form.eventDate.
    const [dateStr, setDateStr] = useState('');
    const [timeStr, setTimeStr] = useState('');

    const [form, setForm] = useState<EventFormData>({
        title: '',
        content: '',
        eventDate: '',
        location: '',
        targetType: 'ALL',
        targetUnitId: undefined,
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
            });
            setDateStr('');
            setTimeStr('');
            unitService.getAll().then(setUnits).catch(() => {});
        }
    }, [isOpen]);

    // Whenever the displayed date or time changes, derive the ISO eventDate.
    useEffect(() => {
        const iso = brToIso(dateStr, timeStr);
        setForm((prev) => (prev.eventDate === iso ? prev : { ...prev, eventDate: iso }));
    }, [dateStr, timeStr]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.title.trim() || !form.content.trim()) {
            toast.error('Título e descrição são obrigatórios.');
            return;
        }

        if (!dateStr || !timeStr) {
            toast.error('Informe a data e a hora do evento.');
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
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => !isSubmitting && onClose()}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: 'spring', duration: 0.3 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-bg-card border border-border-primary rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 pb-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center">
                                    <CalendarDays className="w-5 h-5 text-accent-primary" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-text-primary">
                                        Novo Evento
                                    </h2>
                                    <p className="text-sm text-text-muted">
                                        Crie um evento para o condomínio
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
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

                            {/* Data, Hora e Local */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                    Data e Hora <span className="text-error">*</span>
                                </label>
                                <div className="grid grid-cols-[1.4fr_1fr] gap-3">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={dateStr}
                                        onChange={(e) => setDateStr(maskDate(e.target.value))}
                                        placeholder="DD/MM/AAAA"
                                        maxLength={10}
                                        aria-label="Data do evento"
                                        className="w-full px-4 py-2.5 rounded-xl bg-bg-secondary border border-border-primary text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 text-sm transition-colors font-mono tabular-nums"
                                    />
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={timeStr}
                                        onChange={(e) => setTimeStr(maskTime(e.target.value))}
                                        placeholder="HH:MM"
                                        maxLength={5}
                                        aria-label="Hora do evento (formato 24h)"
                                        className="w-full px-4 py-2.5 rounded-xl bg-bg-secondary border border-border-primary text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 text-sm transition-colors font-mono tabular-nums"
                                    />
                                </div>
                                <p className="mt-1.5 text-[11px] text-text-muted">
                                    Formato 24h. Ex.: 23/05/2026 19:30.
                                </p>
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
                                                {unit.block ? `${unit.block} - ${unit.number}` : unit.number}
                                            </option>
                                        ))}
                                    </select>
                                </motion.div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary border border-border-primary rounded-xl hover:bg-bg-hover transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-accent-gradient-start to-accent-gradient-end rounded-xl hover:shadow-lg hover:shadow-accent-primary/20 transition-all disabled:opacity-60 flex items-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Criando...
                                        </>
                                    ) : (
                                        'Criar Evento'
                                    )}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
