import { useState, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { userService } from '../../services/userService';
import { unitService } from '../../services/unitService';
import type { User, UserFormData, UserRole, UserStatus, Unit } from '../../types/user';
import { formatUnitDisplay } from '../../types/user';

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

export default function UserFormModal({ isOpen, user, onClose, onSuccess }: UserFormModalProps) {
    const [form, setForm] = useState<UserFormData>(emptyForm);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [units, setUnits] = useState<Unit[]>([]);
    const [isLoadingUnits, setIsLoadingUnits] = useState(false);
    const isEditing = !!user;

    // Load units from backend
    useEffect(() => {
        if (isOpen) {
            setIsLoadingUnits(true);
            unitService.getAll()
                .then(setUnits)
                .catch(() => {
                    toast.error('Erro ao carregar unidades.', {
                        position: 'top-right',
                        style: { background: '#16161f', color: '#f0f0f5', border: '1px solid #ef4444' },
                    });
                })
                .finally(() => setIsLoadingUnits(false));
        }
    }, [isOpen]);

    // Format CPF for display: 00000000000 → 000.000.000-00
    const formatCpfForDisplay = (cpf: string) => {
        const cleaned = cpf.replace(/\D/g, '').slice(0, 11);
        if (cleaned.length > 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
        if (cleaned.length > 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
        if (cleaned.length > 3) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
        return cleaned;
    };

    // Format phone for display: 62999990000 → (62) 99999-0000
    const formatPhoneForDisplay = (tel: string) => {
        const cleaned = tel.replace(/\D/g, '').slice(0, 11);
        if (cleaned.length > 6) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
        if (cleaned.length > 2) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
        if (cleaned.length > 0) return `(${cleaned}`;
        return '';
    };

    // Populate form when editing
    useEffect(() => {
        if (user) {
            setForm({
                name: user.name,
                email: user.email,
                cpf: formatCpfForDisplay(user.cpf),
                phone: user.phone ? formatPhoneForDisplay(user.phone) : '',
                password: '', // Don't show password when editing
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

            // If role changes away from MORADOR, clear morador-specific fields
            if (field === 'role' && value !== 'MORADOR') {
                updated.unitId = '';
                updated.isSyndic = false;
                updated.isCouncilMember = false;
            }

            return updated;
        });
    };

    // CPF mask: 000.000.000-00
    const handleCpfChange = (value: string) => {
        let cleaned = value.replace(/\D/g, '').slice(0, 11);
        if (cleaned.length > 9) {
            cleaned = `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
        } else if (cleaned.length > 6) {
            cleaned = `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
        } else if (cleaned.length > 3) {
            cleaned = `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
        }
        handleChange('cpf', cleaned);
    };

    // Phone mask: (00) 00000-0000
    const handlePhoneChange = (value: string) => {
        let cleaned = value.replace(/\D/g, '').slice(0, 11);
        if (cleaned.length > 6) {
            cleaned = `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
        } else if (cleaned.length > 2) {
            cleaned = `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
        } else if (cleaned.length > 0) {
            cleaned = `(${cleaned}`;
        }
        handleChange('phone', cleaned);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        // Validation
        if (!form.name.trim()) {
            toast.error('Nome é obrigatório.');
            return;
        }
        if (!form.email.trim()) {
            toast.error('Email é obrigatório.');
            return;
        }
        if (!form.cpf.trim() || form.cpf.replace(/\D/g, '').length !== 11) {
            toast.error('CPF inválido. Deve conter exatamente 11 dígitos numéricos.');
            return;
        }
        if (!isEditing && !form.password) {
            toast.error('Senha é obrigatória para novo usuário.');
            return;
        }
        // Validate phone if provided
        if (form.phone) {
            const telDigits = form.phone.replace(/\D/g, '');
            if (telDigits.length < 10 || telDigits.length > 11) {
                toast.error('Telefone inválido. Deve conter DDD (2 dígitos) + número (8-9 dígitos).');
                return;
            }
        }
        if (form.role === 'MORADOR' && !form.unitId?.trim()) {
            toast.error('Unidade é obrigatória para moradores.');
            return;
        }

        setIsSubmitting(true);

        try {
            // Prepare data — send CPF and phone without mask
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

            // Only include unitId for MORADOR
            if (form.role === 'MORADOR') {
                submitData.unitId = form.unitId || null;
            } else {
                submitData.unitId = null;
                submitData.isSyndic = false;
                submitData.isCouncilMember = false;
            }

            // Remove empty password on edit
            if (isEditing && !submitData.password) {
                delete submitData.password;
            }

            if (isEditing && user) {
                await userService.update(user.id, submitData);
                toast.success('Usuário atualizado com sucesso!', {
                    position: 'top-right',
                    style: { background: '#16161f', color: '#f0f0f5', border: '1px solid #22c55e' },
                    iconTheme: { primary: '#22c55e', secondary: '#16161f' },
                });
            } else {
                await userService.create(submitData);
                toast.success('Usuário criado com sucesso!', {
                    position: 'top-right',
                    style: { background: '#16161f', color: '#f0f0f5', border: '1px solid #22c55e' },
                    iconTheme: { primary: '#22c55e', secondary: '#16161f' },
                });
            }

            onSuccess();
        } catch (error: any) {
            const message = error.response?.data?.error || 'Erro ao salvar usuário.';
            toast.error(message, {
                position: 'top-right',
                style: { background: '#16161f', color: '#f0f0f5', border: '1px solid #ef4444' },
            });
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
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', duration: 0.35 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-bg-card border border-border-primary rounded-2xl w-full max-w-lg shadow-2xl shadow-black/40 max-h-[90vh] overflow-y-auto"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 pb-4 border-b border-border-primary sticky top-0 bg-bg-card z-10 rounded-t-2xl">
                            <h2 className="text-lg font-semibold text-text-primary">
                                {isEditing ? 'Editar Usuário' : 'Novo Usuário'}
                            </h2>
                            <button
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Name */}
                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-text-secondary">
                                    Nome <span className="text-error">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    placeholder="Nome completo"
                                    className="w-full px-4 py-2.5 bg-bg-input border border-border-primary rounded-xl text-sm text-text-primary placeholder-text-muted focus:border-accent-primary focus:outline-none transition-colors"
                                />
                            </div>

                            {/* Email + CPF row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-text-secondary">
                                        Email <span className="text-error">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => handleChange('email', e.target.value)}
                                        placeholder="email@exemplo.com"
                                        className="w-full px-4 py-2.5 bg-bg-input border border-border-primary rounded-xl text-sm text-text-primary placeholder-text-muted focus:border-accent-primary focus:outline-none transition-colors"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-text-secondary">
                                        CPF <span className="text-error">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.cpf}
                                        onChange={(e) => handleCpfChange(e.target.value)}
                                        placeholder="000.000.000-00"
                                        className="w-full px-4 py-2.5 bg-bg-input border border-border-primary rounded-xl text-sm text-text-primary placeholder-text-muted focus:border-accent-primary focus:outline-none transition-colors font-mono"
                                    />
                                </div>
                            </div>

                            {/* Phone + Password row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-text-secondary">
                                        Telefone
                                    </label>
                                    <input
                                        type="text"
                                        value={form.phone}
                                        onChange={(e) => handlePhoneChange(e.target.value)}
                                        placeholder="(00) 00000-0000"
                                        className="w-full px-4 py-2.5 bg-bg-input border border-border-primary rounded-xl text-sm text-text-primary placeholder-text-muted focus:border-accent-primary focus:outline-none transition-colors"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-text-secondary">
                                        Senha {!isEditing && <span className="text-error">*</span>}
                                    </label>
                                    <input
                                        type="password"
                                        value={form.password || ''}
                                        onChange={(e) => handleChange('password', e.target.value)}
                                        placeholder={isEditing ? 'Deixe vazio para manter' : 'Senha do usuário'}
                                        className="w-full px-4 py-2.5 bg-bg-input border border-border-primary rounded-xl text-sm text-text-primary placeholder-text-muted focus:border-accent-primary focus:outline-none transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Role + Status row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-text-secondary">
                                        Perfil <span className="text-error">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={form.role}
                                            onChange={(e) => handleChange('role', e.target.value as UserRole)}
                                            className="appearance-none w-full px-4 py-2.5 bg-bg-input border border-border-primary rounded-xl text-sm text-text-primary focus:border-accent-primary focus:outline-none transition-colors cursor-pointer pr-10"
                                        >
                                            <option value="MORADOR">Morador</option>
                                            <option value="ADMIN">Administrador</option>
                                            <option value="FUNCIONARIO">Funcionário</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-text-secondary">
                                        Status
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={form.status}
                                            onChange={(e) => handleChange('status', e.target.value as UserStatus)}
                                            className="appearance-none w-full px-4 py-2.5 bg-bg-input border border-border-primary rounded-xl text-sm text-text-primary focus:border-accent-primary focus:outline-none transition-colors cursor-pointer pr-10"
                                        >
                                            <option value="ACTIVE">Ativo</option>
                                            <option value="INACTIVE">Inativo</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            {/* Conditional morador fields */}
                            <AnimatePresence>
                                {form.role === 'MORADOR' && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="space-y-4 pt-2 border-t border-border-primary mt-2">
                                            <p className="text-xs text-text-muted font-medium uppercase tracking-wider pt-2">
                                                Campos do Morador
                                            </p>

                                            {/* Unit dropdown */}
                                            <div className="space-y-1.5">
                                                <label className="block text-sm font-medium text-text-secondary">
                                                    Unidade <span className="text-error">*</span>
                                                </label>
                                                <div className="relative">
                                                    <select
                                                        value={form.unitId || ''}
                                                        onChange={(e) => handleChange('unitId', e.target.value)}
                                                        disabled={isLoadingUnits}
                                                        className="appearance-none w-full px-4 py-2.5 bg-bg-input border border-border-primary rounded-xl text-sm text-text-primary focus:border-accent-primary focus:outline-none transition-colors cursor-pointer pr-10 disabled:opacity-50"
                                                    >
                                                        <option value="">
                                                            {isLoadingUnits ? 'Carregando unidades...' : 'Selecione uma unidade'}
                                                        </option>
                                                        {units.map((unit) => (
                                                            <option key={unit.id} value={unit.id}>
                                                                {formatUnitDisplay(unit)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                                                </div>
                                                {units.length === 0 && !isLoadingUnits && (
                                                    <p className="text-xs text-warning mt-1">
                                                        Nenhuma unidade cadastrada. Cadastre unidades antes de criar um morador.
                                                    </p>
                                                )}
                                            </div>

                                            {/* Syndic + Council checkboxes */}
                                            <div className="flex items-center gap-6">
                                                <label className="flex items-center gap-2.5 cursor-pointer group">
                                                    <div className="relative">
                                                        <input
                                                            type="checkbox"
                                                            checked={form.isSyndic}
                                                            onChange={(e) => handleChange('isSyndic', e.target.checked)}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-5 h-5 rounded-md border-2 border-border-secondary peer-checked:border-accent-primary peer-checked:bg-accent-primary transition-all flex items-center justify-center">
                                                            {form.isSyndic && (
                                                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                                                        Síndico
                                                    </span>
                                                </label>

                                                <label className="flex items-center gap-2.5 cursor-pointer group">
                                                    <div className="relative">
                                                        <input
                                                            type="checkbox"
                                                            checked={form.isCouncilMember}
                                                            onChange={(e) => handleChange('isCouncilMember', e.target.checked)}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-5 h-5 rounded-md border-2 border-border-secondary peer-checked:border-accent-primary peer-checked:bg-accent-primary transition-all flex items-center justify-center">
                                                            {form.isCouncilMember && (
                                                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                                                        Conselheiro
                                                    </span>
                                                </label>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Submit buttons */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-primary">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary border border-border-primary rounded-xl hover:bg-bg-hover transition-colors"
                                >
                                    Cancelar
                                </button>
                                <motion.button
                                    type="submit"
                                    disabled={isSubmitting}
                                    whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                                    whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                                    className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-accent-gradient-start to-accent-gradient-end rounded-xl shadow-lg shadow-accent-primary/20 hover:shadow-accent-primary/30 transition-shadow disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Salvando...
                                        </>
                                    ) : isEditing ? (
                                        'Salvar Alterações'
                                    ) : (
                                        'Criar Usuário'
                                    )}
                                </motion.button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
