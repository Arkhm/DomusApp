import { useState, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { userService } from '../../services/userService';
import type { User, UserFormData, UserPerfil, UserStatus } from '../../types/user';

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
    telefone: '',
    password: '',
    perfil: 'morador',
    unidade: '',
    status: 'ativo',
    is_sindico: false,
    is_conselheiro: false,
};

export default function UserFormModal({ isOpen, user, onClose, onSuccess }: UserFormModalProps) {
    const [form, setForm] = useState<UserFormData>(emptyForm);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isEditing = !!user;

    // Format CPF for display: 00000000000 → 000.000.000-00
    const formatCpfForDisplay = (cpf: string) => {
        const cleaned = cpf.replace(/\D/g, '').slice(0, 11);
        if (cleaned.length > 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
        if (cleaned.length > 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
        if (cleaned.length > 3) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
        return cleaned;
    };

    // Format telefone for display: 62999990000 → (62) 99999-0000
    const formatTelefoneForDisplay = (tel: string) => {
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
                telefone: user.telefone ? formatTelefoneForDisplay(user.telefone) : '',
                password: '', // Don't show password when editing
                perfil: user.perfil,
                unidade: user.unidade || '',
                status: user.status,
                is_sindico: user.is_sindico,
                is_conselheiro: user.is_conselheiro,
            });
        } else {
            setForm(emptyForm);
        }
    }, [user, isOpen]);

    const handleChange = (field: keyof UserFormData, value: any) => {
        setForm((prev) => {
            const updated = { ...prev, [field]: value };

            // If perfil changes away from morador, clear morador-specific fields
            if (field === 'perfil' && value !== 'morador') {
                updated.unidade = '';
                updated.is_sindico = false;
                updated.is_conselheiro = false;
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

    // Telefone mask: (00) 00000-0000
    const handleTelefoneChange = (value: string) => {
        let cleaned = value.replace(/\D/g, '').slice(0, 11);
        if (cleaned.length > 6) {
            cleaned = `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
        } else if (cleaned.length > 2) {
            cleaned = `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
        } else if (cleaned.length > 0) {
            cleaned = `(${cleaned}`;
        }
        handleChange('telefone', cleaned);
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
        // Validate telefone if provided
        if (form.telefone) {
            const telDigits = form.telefone.replace(/\D/g, '');
            if (telDigits.length < 10 || telDigits.length > 11) {
                toast.error('Telefone inválido. Deve conter DDD (2 dígitos) + número (8-9 dígitos).');
                return;
            }
        }
        if (form.perfil === 'morador' && !form.unidade?.trim()) {
            toast.error('Unidade é obrigatória para moradores.');
            return;
        }

        setIsSubmitting(true);

        try {
            // Prepare data — send CPF without mask
            const submitData: any = {
                ...form,
                cpf: form.cpf.replace(/\D/g, ''),
                telefone: form.telefone?.replace(/\D/g, '') || null,
            };

            // Remove empty password on edit
            if (isEditing && !submitData.password) {
                delete submitData.password;
            }

            // Clear morador fields if not morador
            if (submitData.perfil !== 'morador') {
                submitData.unidade = null;
                submitData.is_sindico = false;
                submitData.is_conselheiro = false;
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

                            {/* Telefone + Senha row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-text-secondary">
                                        Telefone
                                    </label>
                                    <input
                                        type="text"
                                        value={form.telefone}
                                        onChange={(e) => handleTelefoneChange(e.target.value)}
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

                            {/* Perfil + Status row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-text-secondary">
                                        Perfil <span className="text-error">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={form.perfil}
                                            onChange={(e) => handleChange('perfil', e.target.value as UserPerfil)}
                                            className="appearance-none w-full px-4 py-2.5 bg-bg-input border border-border-primary rounded-xl text-sm text-text-primary focus:border-accent-primary focus:outline-none transition-colors cursor-pointer pr-10"
                                        >
                                            <option value="morador">Morador</option>
                                            <option value="administrador">Administrador</option>
                                            <option value="funcionario">Funcionário</option>
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
                                            <option value="ativo">Ativo</option>
                                            <option value="inativo">Inativo</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            {/* Conditional morador fields */}
                            <AnimatePresence>
                                {form.perfil === 'morador' && (
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

                                            {/* Unidade */}
                                            <div className="space-y-1.5">
                                                <label className="block text-sm font-medium text-text-secondary">
                                                    Unidade <span className="text-error">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={form.unidade || ''}
                                                    onChange={(e) => handleChange('unidade', e.target.value)}
                                                    placeholder="Ex: Bloco A - 101"
                                                    className="w-full px-4 py-2.5 bg-bg-input border border-border-primary rounded-xl text-sm text-text-primary placeholder-text-muted focus:border-accent-primary focus:outline-none transition-colors"
                                                />
                                            </div>

                                            {/* Sindico + Conselheiro checkboxes */}
                                            <div className="flex items-center gap-6">
                                                <label className="flex items-center gap-2.5 cursor-pointer group">
                                                    <div className="relative">
                                                        <input
                                                            type="checkbox"
                                                            checked={form.is_sindico}
                                                            onChange={(e) => handleChange('is_sindico', e.target.checked)}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-5 h-5 rounded-md border-2 border-border-secondary peer-checked:border-accent-primary peer-checked:bg-accent-primary transition-all flex items-center justify-center">
                                                            {form.is_sindico && (
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
                                                            checked={form.is_conselheiro}
                                                            onChange={(e) => handleChange('is_conselheiro', e.target.checked)}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-5 h-5 rounded-md border-2 border-border-secondary peer-checked:border-accent-primary peer-checked:bg-accent-primary transition-all flex items-center justify-center">
                                                            {form.is_conselheiro && (
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
