import { useEffect, useState, type FormEvent } from 'react';
import { Megaphone, Users as UsersIcon, Send, FileText, CheckCircle2, Bell, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { noticeService } from '../../services/noticeService';
import { unitService } from '../../services/unitService';
import type { NoticeFormData } from '../../types/notice';
import type { Unit } from '../../types/user';
import { formatUnitDisplay } from '../../types/user';
import LuxuryModal, { LuxuryModalFooter } from '../../components/luxury/LuxuryModal';
import { apiErrorMessage } from '../../lib/apiError';

interface NoticeFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const emptyForm: NoticeFormData = {
    title: '',
    content: '',
    targetType: 'ALL',
    status: 'PUBLISHED',
    priority: 'NORMAL',
};

export default function NoticeFormModal({ isOpen, onClose, onSuccess }: NoticeFormModalProps) {
    const [form, setForm] = useState<NoticeFormData>(emptyForm);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [units, setUnits] = useState<Unit[]>([]);

    useEffect(() => {
        if (isOpen) {
            setForm(emptyForm);
            setIsSubmitting(false);
            unitService.getAll().then(setUnits).catch(() => {});
        }
    }, [isOpen]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!form.title.trim()) {
            toast.error('Título é obrigatório.');
            return;
        }
        if (!form.content.trim()) {
            toast.error('Conteúdo é obrigatório.');
            return;
        }
        if (form.targetType === 'UNIT' && !form.targetUnitId) {
            toast.error('Selecione a unidade de destino.');
            return;
        }

        setIsSubmitting(true);
        try {
            await noticeService.create(form);
            toast.success('Comunicado enviado.');
            onSuccess();
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Erro ao enviar comunicado.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            setForm(emptyForm);
            onClose();
        }
    };

    return (
        <LuxuryModal
            open={isOpen}
            onClose={handleClose}
            busy={isSubmitting}
            icon={<Megaphone size={18} strokeWidth={1.4} />}
            title="Novo Comunicado"
            subtitle="Publique um aviso para os residentes"
            size="lg"
        >
            <form
                onSubmit={handleSubmit}
                style={{ padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}
            >
                <Field label="Título" required>
                    <input
                        type="text"
                        value={form.title}
                        onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                        placeholder="Ex: Manutenção programada nas bombas hidráulicas"
                        maxLength={120}
                        autoFocus
                        className="luxe-input"
                    />
                </Field>

                <Field label="Conteúdo" required helper={`${form.content.length} caracteres`}>
                    <textarea
                        value={form.content}
                        onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                        rows={8}
                        placeholder="Descreva o comunicado em detalhes…"
                        className="luxe-input"
                        style={{ minHeight: 200, resize: 'vertical', lineHeight: 1.6, padding: '12px 14px' }}
                    />
                </Field>

                <Field label="Status" required>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <TargetOption
                            active={form.status === 'PUBLISHED'}
                            icon={<CheckCircle2 size={16} />}
                            label="Publicar agora"
                            helper="Visível aos residentes"
                            onClick={() => setForm((p) => ({ ...p, status: 'PUBLISHED' }))}
                        />
                        <TargetOption
                            active={form.status === 'DRAFT'}
                            icon={<FileText size={16} />}
                            label="Salvar como rascunho"
                            helper="Apenas administradores veem"
                            onClick={() => setForm((p) => ({ ...p, status: 'DRAFT' }))}
                        />
                    </div>
                </Field>

                <Field label="Prioridade" required>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <TargetOption
                            active={form.priority === 'NORMAL'}
                            icon={<Bell size={16} />}
                            label="Normal"
                            helper="Comunicado padrão"
                            onClick={() => setForm((p) => ({ ...p, priority: 'NORMAL' }))}
                        />
                        <TargetOption
                            active={form.priority === 'URGENT'}
                            icon={<AlertTriangle size={16} />}
                            label="Urgente"
                            helper="Destaque vermelho no card"
                            onClick={() => setForm((p) => ({ ...p, priority: 'URGENT' }))}
                        />
                    </div>
                </Field>

                <Field label="Destinatário" required>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <TargetOption
                            active={form.targetType === 'ALL'}
                            icon={<UsersIcon size={16} />}
                            label="Todos os residentes"
                            helper="Aviso geral"
                            onClick={() => setForm((p) => ({ ...p, targetType: 'ALL', targetUnitId: undefined }))}
                        />
                        <TargetOption
                            active={form.targetType === 'UNIT'}
                            icon={<Send size={16} />}
                            label="Unidade específica"
                            helper="Aviso direcionado"
                            onClick={() => setForm((p) => ({ ...p, targetType: 'UNIT' }))}
                        />
                    </div>
                </Field>

                {form.targetType === 'UNIT' && (
                    <Field label="Unidade" required>
                        <select
                            value={form.targetUnitId || ''}
                            onChange={(e) => setForm((p) => ({ ...p, targetUnitId: e.target.value }))}
                            className="luxe-input"
                            style={{ cursor: 'pointer' }}
                        >
                            <option value="">Selecione uma unidade</option>
                            {units.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {formatUnitDisplay(u)}
                                </option>
                            ))}
                        </select>
                        {units.length === 0 && (
                            <p style={{ marginTop: 6, fontSize: 11, color: 'var(--color-warn)' }}>
                                Nenhuma unidade cadastrada. Cadastre antes de criar um comunicado direcionado.
                            </p>
                        )}
                    </Field>
                )}

                <LuxuryModalFooter
                    onCancel={handleClose}
                    submitLabel="Publicar comunicado"
                    loadingLabel="Enviando…"
                    isSubmitting={isSubmitting}
                />
            </form>
        </LuxuryModal>
    );
}

function Field({
    label,
    required,
    helper,
    children,
}: {
    label: string;
    required?: boolean;
    helper?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <label
                    className="tracking-luxe"
                    style={{ fontSize: 9, color: 'var(--color-bone-dim)' }}
                >
                    {label}
                    {required && <span style={{ color: 'var(--color-err)', marginLeft: 4 }}>*</span>}
                </label>
                {helper && (
                    <span style={{ fontSize: 10, color: 'var(--color-bone-muted)' }}>{helper}</span>
                )}
            </div>
            {children}
        </div>
    );
}

function TargetOption({
    active,
    icon,
    label,
    helper,
    onClick,
}: {
    active: boolean;
    icon: React.ReactNode;
    label: string;
    helper: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 6,
                padding: '14px 16px',
                background: active
                    ? 'color-mix(in srgb, var(--color-metal-1) 8%, transparent)'
                    : 'var(--color-ink-1)',
                border: `1px solid ${active ? 'var(--color-metal-1)' : 'var(--color-line-strong)'}`,
                borderRadius: 3,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'var(--font-sans)',
                textAlign: 'left',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: active ? 'var(--color-metal-1)' : 'var(--color-bone)',
                    fontSize: 13,
                    fontWeight: 500,
                }}
            >
                {icon}
                {label}
            </div>
            <div className="tracking-luxe" style={{ fontSize: 8, color: 'var(--color-bone-muted)' }}>
                {helper}
            </div>
        </button>
    );
}
