import { useState, useEffect, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { UserPlus, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { userService } from '../../services/userService';
import { unitService } from '../../services/unitService';
import type { User, UserFormData, UserRole, UserStatus, Unit } from '../../types/user';
import { formatUnitDisplay } from '../../types/user';
import { isValidCpf } from '../../components/luxury/formatters';
import LuxuryModal, { LuxuryModalFooter } from '../../components/luxury/LuxuryModal';

interface UserFormModalProps {
    isOpen: boolean;
    user: User | null; // null = creating, User = editing
    onClose: () => void;
    onSuccess: () => void;
}

const emptyForm: UserFormData = {
    name: '',
    email: '',
    cpf: '',
    phone: '',
    password: '',
    role: 'MORADOR',
    unitId: '',
    status: 'ACTIVE',
    isSyndic: false,
    isCouncilMember: false,
};

// Regex razoável de e-mail: pelo menos uma letra+ponto+letra após o @.
// Não cobre todos os casos do RFC 5322 (impraticável) — mas rejeita
// "a@b.c", "user@", "@example.com" e variantes inválidas comuns.
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function UserFormModal({ isOpen, user, onClose, onSuccess }: UserFormModalProps) {
    const [form, setForm] = useState<UserFormData>(emptyForm);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [units, setUnits] = useState<Unit[]>([]);
    const [isLoadingUnits, setIsLoadingUnits] = useState(false);
    const isEditing = !!user;

    useEffect(() => {
        if (isOpen) {
            setIsLoadingUnits(true);
            unitService
                .getAll()
                .then(setUnits)
                .catch(() => toast.error('Erro ao carregar unidades.'))
                .finally(() => setIsLoadingUnits(false));
        }
    }, [isOpen]);

    const formatCpfForDisplay = (cpf: string) => {
        const cleaned = cpf.replace(/\D/g, '').slice(0, 11);
        if (cleaned.length > 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
        if (cleaned.length > 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
        if (cleaned.length > 3) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
        return cleaned;
    };

    const formatPhoneForDisplay = (tel: string) => {
        const cleaned = tel.replace(/\D/g, '').slice(0, 11);
        if (cleaned.length > 6) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
        if (cleaned.length > 2) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
        if (cleaned.length > 0) return `(${cleaned}`;
        return '';
    };

    useEffect(() => {
        if (user) {
            setForm({
                name: user.name,
                email: user.email,
                cpf: formatCpfForDisplay(user.cpf),
                phone: user.phone ? formatPhoneForDisplay(user.phone) : '',
                password: '',
                role: user.role,
                unitId: user.unitId || '',
                status: user.status,
                isSyndic: user.isSyndic,
                isCouncilMember: user.isCouncilMember,
            });
        } else {
            setForm(emptyForm);
        }
    }, [user, isOpen]);

    const handleChange = (field: keyof UserFormData, value: any) => {
        setForm((prev) => {
            const updated = { ...prev, [field]: value };
            if (field === 'role' && value !== 'MORADOR') {
                updated.unitId = '';
                updated.isSyndic = false;
                updated.isCouncilMember = false;
            }
            return updated;
        });
    };

    const handleCpfChange = (value: string) => handleChange('cpf', formatCpfForDisplay(value));
    const handlePhoneChange = (value: string) => handleChange('phone', formatPhoneForDisplay(value));

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!form.name.trim()) {
            toast.error('Nome é obrigatório.');
            return;
        }
        if (!form.email.trim()) {
            toast.error('E-mail é obrigatório.');
            return;
        }
        if (!EMAIL_RX.test(form.email.trim())) {
            toast.error('E-mail inválido. Use o formato usuario@dominio.com.');
            return;
        }
        if (!form.cpf.trim() || form.cpf.replace(/\D/g, '').length !== 11) {
            toast.error('CPF inválido. Deve conter 11 dígitos.');
            return;
        }
        if (!isValidCpf(form.cpf)) {
            toast.error('CPF inválido. Verifique os dígitos verificadores.');
            return;
        }
        if (!isEditing && !form.password) {
            toast.error('Senha é obrigatória para novo usuário.');
            return;
        }
        if (form.phone) {
            const telDigits = form.phone.replace(/\D/g, '');
            if (telDigits.length < 10 || telDigits.length > 11) {
                toast.error('Telefone inválido. Use DDD + número (10 ou 11 dígitos).');
                return;
            }
        }
        if (form.role === 'MORADOR' && !form.unitId?.trim()) {
            toast.error('Unidade é obrigatória para residentes.');
            return;
        }

        setIsSubmitting(true);
        try {
            const submitData: any = {
                name: form.name,
                email: form.email,
                cpf: form.cpf.replace(/\D/g, ''),
                phone: form.phone?.replace(/\D/g, '') || null,
                password: form.password || undefined,
                role: form.role,
                status: form.status,
                isSyndic: form.isSyndic,
                isCouncilMember: form.isCouncilMember,
            };

            if (form.role === 'MORADOR') {
                submitData.unitId = form.unitId || null;
            } else {
                submitData.unitId = null;
                submitData.isSyndic = false;
                submitData.isCouncilMember = false;
            }

            if (isEditing && !submitData.password) delete submitData.password;

            if (isEditing && user) {
                await userService.update(user.id, submitData);
                toast.success('Residente atualizado.');
            } else {
                await userService.create(submitData);
                toast.success('Residente criado.');
            }
            onSuccess();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao salvar residente.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <LuxuryModal
            open={isOpen}
            onClose={onClose}
            busy={isSubmitting}
            icon={<UserPlus size={18} strokeWidth={1.4} />}
            title={isEditing ? 'Editar residente' : 'Novo residente'}
            subtitle={isEditing ? 'Atualize os dados cadastrais' : 'Cadastre um residente, administrador ou membro da equipe'}
            size="lg"
        >
            <form onSubmit={handleSubmit} style={{ padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <Field label="Nome completo" required>
                    <input
                        type="text"
                        value={form.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        placeholder="Nome completo"
                        className="luxe-input"
                        autoFocus
                    />
                </Field>

                <Row>
                    <Field label="E-mail" required>
                        <input
                            type="email"
                            autoComplete="email"
                            value={form.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                            placeholder="email@exemplo.com"
                            className="luxe-input"
                        />
                    </Field>
                    <Field label="CPF" required>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={form.cpf}
                            onChange={(e) => handleCpfChange(e.target.value)}
                            placeholder="000.000.000-00"
                            className="luxe-input mono"
                        />
                    </Field>
                </Row>

                <Row>
                    <Field label="Telefone">
                        <input
                            type="tel"
                            inputMode="numeric"
                            value={form.phone}
                            onChange={(e) => handlePhoneChange(e.target.value)}
                            placeholder="(00) 00000-0000"
                            className="luxe-input"
                        />
                    </Field>
                    <Field label={`Senha${isEditing ? '' : ' *'}`}>
                        <input
                            type="password"
                            autoComplete="new-password"
                            value={form.password || ''}
                            onChange={(e) => handleChange('password', e.target.value)}
                            placeholder={isEditing ? 'Deixe vazio para manter' : 'Senha do residente'}
                            className="luxe-input"
                        />
                    </Field>
                </Row>

                <Row>
                    <Field label="Perfil" required>
                        <select
                            value={form.role}
                            onChange={(e) => handleChange('role', e.target.value as UserRole)}
                            className="luxe-input"
                            style={{ cursor: 'pointer' }}
                        >
                            <option value="MORADOR">Residente</option>
                            <option value="ADMIN">Administração</option>
                            <option value="FUNCIONARIO">Equipe</option>
                        </select>
                    </Field>
                    <Field label="Status">
                        <select
                            value={form.status}
                            onChange={(e) => handleChange('status', e.target.value as UserStatus)}
                            className="luxe-input"
                            style={{ cursor: 'pointer' }}
                        >
                            <option value="ACTIVE">Ativo</option>
                            <option value="INACTIVE">Inativo</option>
                        </select>
                    </Field>
                </Row>

                <AnimatePresence>
                    {form.role === 'MORADOR' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{ overflow: 'hidden' }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 16,
                                    paddingTop: 16,
                                    borderTop: '1px solid var(--color-line)',
                                }}
                            >
                                <Field label="Unidade" required>
                                    <select
                                        value={form.unitId || ''}
                                        onChange={(e) => handleChange('unitId', e.target.value)}
                                        disabled={isLoadingUnits}
                                        className="luxe-input"
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <option value="">
                                            {isLoadingUnits ? 'Carregando unidades…' : 'Selecione uma unidade'}
                                        </option>
                                        {units.map((unit) => (
                                            <option key={unit.id} value={unit.id}>
                                                {formatUnitDisplay(unit)}
                                            </option>
                                        ))}
                                    </select>
                                    {units.length === 0 && !isLoadingUnits && (
                                        <p style={{ marginTop: 6, fontSize: 11, color: 'var(--color-warn)' }}>
                                            Nenhuma unidade cadastrada. Cadastre antes de criar um residente.
                                        </p>
                                    )}
                                </Field>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                                    <LuxuryCheckbox
                                        checked={form.isSyndic}
                                        onChange={(v) => handleChange('isSyndic', v)}
                                        label="Síndico"
                                    />
                                    <LuxuryCheckbox
                                        checked={form.isCouncilMember}
                                        onChange={(v) => handleChange('isCouncilMember', v)}
                                        label="Conselheiro"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <LuxuryModalFooter
                    onCancel={onClose}
                    submitLabel={isEditing ? 'Salvar alterações' : 'Criar residente'}
                    loadingLabel="Salvando…"
                    isSubmitting={isSubmitting}
                />
            </form>
        </LuxuryModal>
    );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div style={{ flex: 1, minWidth: 0 }}>
            <label
                className="tracking-luxe"
                style={{ display: 'block', fontSize: 9, color: 'var(--color-bone-dim)', marginBottom: 8 }}
            >
                {label}
                {required && <span style={{ color: 'var(--color-err)', marginLeft: 4 }}>*</span>}
            </label>
            {children}
        </div>
    );
}

function Row({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {children}
        </div>
    );
}

function LuxuryCheckbox({
    checked,
    onChange,
    label,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
}) {
    return (
        <label
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                userSelect: 'none',
            }}
        >
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            />
            <span
                style={{
                    width: 18,
                    height: 18,
                    borderRadius: 2,
                    border: `1px solid ${checked ? 'var(--color-metal-1)' : 'var(--color-line-strong)'}`,
                    background: checked ? 'var(--color-metal-1)' : 'transparent',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    transition: 'all 0.15s ease',
                }}
            >
                {checked && <Check size={12} strokeWidth={3} />}
            </span>
            <span style={{ fontSize: 13, color: 'var(--color-bone-soft)' }}>{label}</span>
        </label>
    );
}
