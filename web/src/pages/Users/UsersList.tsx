import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Search,
    Plus,
    Edit3,
    Trash2,
    Filter,
    Users,
    ChevronDown,
    Loader2,
    AlertCircle,
    X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { userService } from '../../services/userService';
import { PERFIL_LABELS, STATUS_LABELS } from '../../types/user';
import type { User, UserPerfil, UserStatus } from '../../types/user';
import UserFormModal from './UserFormModal';
import Header from '../../components/layout/Header';

export default function UsersList() {
    const [users, setUsers] = useState<User[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterPerfil, setFilterPerfil] = useState<UserPerfil | ''>('');
    const [filterStatus, setFilterStatus] = useState<UserStatus | ''>('');
    const [showFilters, setShowFilters] = useState(false);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    // Delete confirmation
    const [deletingUser, setDeletingUser] = useState<User | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Load users
    const loadUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await userService.getAll();
            setUsers(data);
        } catch (error: any) {
            toast.error('Erro ao carregar usuários.', {
                position: 'top-right',
                style: { background: '#16161f', color: '#f0f0f5', border: '1px solid #ef4444' },
            });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    // Filter users
    useEffect(() => {
        let result = [...users];

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (u) =>
                    u.name.toLowerCase().includes(q) ||
                    u.email.toLowerCase().includes(q) ||
                    u.cpf.includes(q)
            );
        }

        if (filterPerfil) {
            result = result.filter((u) => u.perfil === filterPerfil);
        }

        if (filterStatus) {
            result = result.filter((u) => u.status === filterStatus);
        }

        setFilteredUsers(result);
    }, [users, searchQuery, filterPerfil, filterStatus]);

    // Handlers
    const handleCreateUser = () => {
        setEditingUser(null);
        setIsModalOpen(true);
    };

    const handleEditUser = (user: User) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handleDeleteUser = async () => {
        if (!deletingUser) return;

        setIsDeleting(true);
        try {
            await userService.delete(deletingUser.id);
            toast.success('Usuário removido com sucesso!', {
                position: 'top-right',
                style: { background: '#16161f', color: '#f0f0f5', border: '1px solid #22c55e' },
                iconTheme: { primary: '#22c55e', secondary: '#16161f' },
            });
            setDeletingUser(null);
            loadUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao remover usuário.', {
                position: 'top-right',
                style: { background: '#16161f', color: '#f0f0f5', border: '1px solid #ef4444' },
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setEditingUser(null);
    };

    const handleModalSuccess = () => {
        handleModalClose();
        loadUsers();
    };

    const formatCpf = (cpf: string) => {
        const cleaned = cpf.replace(/\D/g, '');
        if (cleaned.length !== 11) return cpf;
        return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
    };

    const formatTelefone = (tel: string | null) => {
        if (!tel) return '—';
        const cleaned = tel.replace(/\D/g, '');
        if (cleaned.length === 11) {
            return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
        }
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
        }
        return tel;
    };

    return (
        <div className="bg-bg-primary">
            <Header title="Usuários" />

            <div className="p-8">
                {/* Top bar: Search + Filters + New User button */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    {/* Search */}
                    <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Buscar por nome, email ou CPF..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-2.5 bg-bg-input border border-border-primary rounded-lg text-sm text-text-primary placeholder-text-muted focus:border-accent-primary focus:outline-none transition-colors"
                            />
                        </div>

                        {/* Filter toggle */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 ${showFilters || filterPerfil || filterStatus
                                ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                                : 'bg-bg-input border-border-primary text-text-secondary hover:text-text-primary'
                                }`}
                        >
                            <Filter className="w-4 h-4" />
                            Filtros
                            {(filterPerfil || filterStatus) && (
                                <span className="w-5 h-5 bg-accent-primary text-white text-xs rounded-full flex items-center justify-center">
                                    {(filterPerfil ? 1 : 0) + (filterStatus ? 1 : 0)}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* New user button */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleCreateUser}
                        className="flex items-center gap-2 px-7 py-2.5 bg-gradient-to-r from-accent-gradient-start to-accent-gradient-end text-white font-medium rounded-lg shadow-lg shadow-accent-primary/20 hover:shadow-accent-primary/30 transition-shadow text-sm whitespace-nowrap flex-shrink-0"
                    >
                        <Plus className="w-4 h-4" />
                        Novo Usuário
                    </motion.button>
                </div>

                {/* Filter bar */}
                <AnimatePresence>
                    {showFilters && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden mb-4"
                        >
                            <div className="flex items-center gap-4 p-4 bg-bg-card border border-border-primary rounded-xl">
                                {/* Perfil filter */}
                                <div className="relative">
                                    <select
                                        value={filterPerfil}
                                        onChange={(e) => setFilterPerfil(e.target.value as UserPerfil | '')}
                                        className="appearance-none px-4 py-2 pr-10 bg-bg-input border border-border-primary rounded-lg text-sm text-text-primary focus:border-accent-primary focus:outline-none cursor-pointer"
                                    >
                                        <option value="">Todos os Perfis</option>
                                        <option value="morador">Morador</option>
                                        <option value="administrador">Administrador</option>
                                        <option value="funcionario">Funcionário</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                                </div>

                                {/* Status filter */}
                                <div className="relative">
                                    <select
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value as UserStatus | '')}
                                        className="appearance-none px-4 py-2 pr-10 bg-bg-input border border-border-primary rounded-lg text-sm text-text-primary focus:border-accent-primary focus:outline-none cursor-pointer"
                                    >
                                        <option value="">Todos os Status</option>
                                        <option value="ativo">Ativo</option>
                                        <option value="inativo">Inativo</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                                </div>

                                {/* Clear filters */}
                                {(filterPerfil || filterStatus) && (
                                    <button
                                        onClick={() => {
                                            setFilterPerfil('');
                                            setFilterStatus('');
                                        }}
                                        className="text-sm text-accent-primary hover:text-accent-primary-hover transition-colors"
                                    >
                                        Limpar filtros
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Stats bar */}
                <div className="flex items-center gap-2 mb-4 text-sm text-text-muted">
                    <Users className="w-4 h-4" />
                    <span>
                        {filteredUsers.length} {filteredUsers.length === 1 ? 'usuário' : 'usuários'}
                        {searchQuery || filterPerfil || filterStatus ? ' encontrados' : ' cadastrados'}
                    </span>
                </div>

                {/* Table */}
                <div className="bg-bg-card border border-border-primary rounded-xl overflow-hidden">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-6 h-6 text-accent-primary animate-spin" />
                            <span className="ml-3 text-text-secondary">Carregando usuários...</span>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                            <AlertCircle className="w-10 h-10 mb-3 opacity-50" />
                            <p className="text-base font-medium">Nenhum usuário encontrado</p>
                            <p className="text-sm mt-1">
                                {searchQuery || filterPerfil || filterStatus
                                    ? 'Tente ajustar os filtros de busca'
                                    : 'Clique em "+ Novo Usuário" para começar'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full table-fixed">
                                <colgroup>
                                    <col className="w-[18%]" /> {/* Nome */}
                                    <col className="w-[17%]" /> {/* Email */}
                                    <col className="w-[12%]" /> {/* Telefone */}
                                    <col className="w-[13%]" /> {/* CPF */}
                                    <col className="w-[11%]" /> {/* Perfil */}
                                    <col className="w-[11%]" /> {/* Unidade */}
                                    <col className="w-[9%]" />  {/* Status */}
                                    <col className="w-[9%]" />  {/* Ações */}
                                </colgroup>
                                <thead>
                                    <tr className="border-b border-border-primary">
                                        <th className="text-left py-3 px-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Nome</th>
                                        <th className="text-left py-3 px-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Email</th>
                                        <th className="text-left py-3 px-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Telefone</th>
                                        <th className="text-left py-3 px-3 text-xs font-semibold text-text-muted uppercase tracking-wider">CPF</th>
                                        <th className="text-left py-3 px-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Perfil</th>
                                        <th className="text-left py-3 px-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Unidade</th>
                                        <th className="text-left py-3 px-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                                        <th className="text-right py-3 px-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-primary">
                                    {filteredUsers.map((user, index) => (
                                        <motion.tr
                                            key={user.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.03 }}
                                            className="hover:bg-bg-hover transition-colors group"
                                        >
                                            {/* Name + avatar */}
                                            <td className="py-3 px-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent-gradient-start to-accent-gradient-end flex items-center justify-center flex-shrink-0">
                                                        <span className="text-[11px] font-semibold text-white">
                                                            {user.name.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-text-primary truncate">
                                                            {user.name}
                                                            {user.is_sindico && (
                                                                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-warning-bg text-warning font-medium">
                                                                    Síndico
                                                                </span>
                                                            )}
                                                            {user.is_conselheiro && (
                                                                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-info-bg text-info font-medium">
                                                                    Conselheiro
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 text-sm text-text-secondary truncate">{user.email}</td>
                                            <td className="py-3 px-3 text-sm text-text-secondary">{formatTelefone(user.telefone)}</td>
                                            <td className="py-3 px-3 text-sm text-text-secondary font-mono text-[13px]">{formatCpf(user.cpf)}</td>
                                            <td className="py-3 px-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${user.perfil === 'administrador'
                                                    ? 'bg-accent-primary/10 text-accent-primary'
                                                    : user.perfil === 'funcionario'
                                                        ? 'bg-warning-bg text-warning'
                                                        : 'bg-info-bg text-info'
                                                    }`}>
                                                    {PERFIL_LABELS[user.perfil] || user.perfil}
                                                </span>
                                            </td>
                                            <td className="py-3 px-3 text-sm text-text-secondary truncate">{user.unidade || '—'}</td>
                                            <td className="py-3 px-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${user.status === 'ativo'
                                                    ? 'bg-badge-ativo-bg text-badge-ativo'
                                                    : 'bg-badge-inativo-bg text-badge-inativo'
                                                    }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'ativo' ? 'bg-badge-ativo' : 'bg-badge-inativo'
                                                        }`} />
                                                    {STATUS_LABELS[user.status] || user.status}
                                                </span>
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="flex items-center justify-end gap-0.5">
                                                    <button
                                                        onClick={() => handleEditUser(user)}
                                                        className="p-1.5 rounded-lg text-text-muted hover:text-accent-primary hover:bg-accent-primary/10 transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeletingUser(user)}
                                                        className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-bg transition-colors"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete confirmation modal */}
            <AnimatePresence>
                {deletingUser && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => !isDeleting && setDeletingUser(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: 'spring', duration: 0.3 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-bg-card border border-border-primary rounded-2xl p-6 w-full max-w-sm shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-text-primary">Confirmar Exclusão</h3>
                                <button
                                    onClick={() => setDeletingUser(null)}
                                    disabled={isDeleting}
                                    className="p-1 rounded-lg text-text-muted hover:text-text-primary transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="text-sm text-text-secondary mb-6">
                                Tem certeza que deseja remover o usuário <strong className="text-text-primary">{deletingUser.name}</strong>? Esta ação não pode ser desfeita.
                            </p>
                            <div className="flex items-center justify-end gap-3">
                                <button
                                    onClick={() => setDeletingUser(null)}
                                    disabled={isDeleting}
                                    className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary border border-border-primary rounded-xl hover:bg-bg-hover transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDeleteUser}
                                    disabled={isDeleting}
                                    className="px-4 py-2 text-sm font-medium text-white bg-error rounded-xl hover:bg-error/90 transition-colors disabled:opacity-60 flex items-center gap-2"
                                >
                                    {isDeleting ? (
                                        <>
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            Excluindo...
                                        </>
                                    ) : (
                                        'Excluir'
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* User Create/Edit Modal */}
            <UserFormModal
                isOpen={isModalOpen}
                user={editingUser}
                onClose={handleModalClose}
                onSuccess={handleModalSuccess}
            />
        </div>
    );
}
