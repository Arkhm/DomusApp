import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, Edit3, Trash2, Filter, Loader2, Crown } from 'lucide-react';
import toast from 'react-hot-toast';
import { userService } from '../../services/userService';
import { ROLE_LABELS, STATUS_LABELS } from '../../types/user';
import type { User, UserRole, UserStatus } from '../../types/user';
import UserFormModal from './UserFormModal';
import Header from '../../components/layout/Header';
import PageBody from '../../components/luxury/PageBody';
import Tag from '../../components/luxury/Tag';
import { formatCpf, formatPhone, getInitials } from '../../components/luxury/formatters';
import { FilterSelect, ListMeta, IconBtn, EmptyTable, DeleteModal } from '../../components/luxury/ListHelpers';

export default function UsersList() {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRole, setFilterRole] = useState<UserRole | ''>('');
    const [filterStatus, setFilterStatus] = useState<UserStatus | ''>('');
    const [showFilters, setShowFilters] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    const [deletingUser, setDeletingUser] = useState<User | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await userService.getAll();
            setUsers(data);
        } catch {
            toast.error('Erro ao carregar residentes.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const filtered = useMemo(() => {
        return users.filter((u) => {
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                if (
                    !u.name.toLowerCase().includes(q) &&
                    !u.email.toLowerCase().includes(q) &&
                    !u.cpf.includes(q)
                ) {
                    return false;
                }
            }
            if (filterRole && u.role !== filterRole) return false;
            if (filterStatus && u.status !== filterStatus) return false;
            return true;
        });
    }, [users, searchQuery, filterRole, filterStatus]);

    const handleCreate = () => {
        setEditingUser(null);
        setIsModalOpen(true);
    };
    const handleEdit = (u: User) => {
        setEditingUser(u);
        setIsModalOpen(true);
    };
    const handleDelete = async () => {
        if (!deletingUser) return;
        setIsDeleting(true);
        try {
            await userService.delete(deletingUser.id);
            toast.success('Residente removido.');
            setDeletingUser(null);
            loadUsers();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Erro ao remover residente.');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div>
            <Header title="Residentes" eyebrow="Cadastro · Acesso · Perfis" />

            <PageBody>
                {/* Toolbar */}
                <div style={{ marginBottom: 32 }}>
                    <div
                        style={{
                            display: 'flex',
                            gap: 16,
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                        }}
                    >
                        <div style={{ display: 'flex', gap: 12, flex: 1, maxWidth: 720 }}>
                            <div style={{ position: 'relative', flex: 1, maxWidth: 440 }}>
                                <Search
                                    size={14}
                                    style={{
                                        position: 'absolute',
                                        left: 14,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: 'var(--color-bone-muted)',
                                    }}
                                />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Buscar por nome, e-mail ou CPF…"
                                    className="luxe-input"
                                    style={{ paddingLeft: 40 }}
                                />
                            </div>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className="btn-ghost"
                                style={{
                                    background:
                                        showFilters || filterRole || filterStatus
                                            ? 'color-mix(in srgb, var(--color-metal-1) 6%, transparent)'
                                            : 'transparent',
                                    borderColor:
                                        showFilters || filterRole || filterStatus
                                            ? 'var(--metal-line-strong)'
                                            : undefined,
                                    color:
                                        showFilters || filterRole || filterStatus
                                            ? 'var(--color-metal-1)'
                                            : undefined,
                                }}
                            >
                                <Filter size={12} />
                                Filtros
                            </button>
                        </div>

                        <button onClick={handleCreate} className="btn-gold">
                            <Plus size={12} />
                            Novo residente
                        </button>
                    </div>

                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                style={{ overflow: 'hidden' }}
                            >
                                <div
                                    style={{
                                        marginTop: 16,
                                        padding: '20px 24px',
                                        background: 'var(--color-ink-1)',
                                        border: '1px solid var(--color-line-strong)',
                                        borderRadius: 4,
                                        display: 'flex',
                                        gap: 16,
                                        flexWrap: 'wrap',
                                        alignItems: 'center',
                                    }}
                                >
                                    <FilterSelect
                                        value={filterRole}
                                        onChange={(v) => setFilterRole(v as UserRole | '')}
                                        placeholder="Todos os perfis"
                                        options={[
                                            { value: 'MORADOR', label: 'Residente' },
                                            { value: 'ADMIN', label: 'Administração' },
                                            { value: 'FUNCIONARIO', label: 'Equipe' },
                                        ]}
                                    />
                                    <FilterSelect
                                        value={filterStatus}
                                        onChange={(v) => setFilterStatus(v as UserStatus | '')}
                                        placeholder="Todos os status"
                                        options={[
                                            { value: 'ACTIVE', label: 'Ativo' },
                                            { value: 'INACTIVE', label: 'Inativo' },
                                        ]}
                                    />
                                    {(filterRole || filterStatus) && (
                                        <button
                                            onClick={() => {
                                                setFilterRole('');
                                                setFilterStatus('');
                                            }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--color-metal-1)',
                                                fontSize: 12,
                                                cursor: 'pointer',
                                                fontFamily: 'var(--font-sans)',
                                            }}
                                        >
                                            Limpar filtros
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <ListMeta
                    count={filtered.length}
                    singular="residente"
                    plural="residentes"
                    filtered={!!(searchQuery || filterRole || filterStatus)}
                />

                {/* Table */}
                <div className="luxe-card fade-up" style={{ overflow: 'hidden' }}>
                    {isLoading ? (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '80px 0',
                                color: 'var(--color-bone-dim)',
                                gap: 12,
                            }}
                        >
                            <Loader2 size={18} className="animate-spin" />
                            <span>Carregando residentes…</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <EmptyTable
                            title="Nenhum residente encontrado"
                            hint={
                                searchQuery || filterRole || filterStatus
                                    ? 'Tente ajustar os filtros.'
                                    : 'Clique em "Novo residente" para começar.'
                            }
                        />
                    ) : (
                        <table className="luxe-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '26%' }}>Nome</th>
                                    <th style={{ width: '20%' }}>Contato</th>
                                    <th style={{ width: '14%' }}>CPF</th>
                                    <th style={{ width: '14%' }}>Unidade</th>
                                    <th style={{ width: '12%' }}>Perfil</th>
                                    <th style={{ width: '10%' }}>Status</th>
                                    <th style={{ width: '4%', textAlign: 'right' }} aria-label="Ações" />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((u) => (
                                    <tr key={u.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                                <div
                                                    className="avatar"
                                                    style={{ width: 38, height: 38, fontSize: 13 }}
                                                >
                                                    {getInitials(u.name)}
                                                </div>
                                                <div>
                                                    <div
                                                        className="serif"
                                                        style={{
                                                            fontSize: 16,
                                                            color: 'var(--color-bone)',
                                                            fontWeight: 500,
                                                            lineHeight: 1.15,
                                                        }}
                                                    >
                                                        {u.name}
                                                    </div>
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            gap: 6,
                                                            marginTop: 6,
                                                            flexWrap: 'wrap',
                                                        }}
                                                    >
                                                        {u.isSyndic && (
                                                            <Tag tone="gold">
                                                                <Crown size={9} /> Síndico
                                                            </Tag>
                                                        )}
                                                        {u.isCouncilMember && (
                                                            <Tag tone="purple">Conselho</Tag>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ color: 'var(--color-bone-soft)' }}>{u.email}</div>
                                            <div
                                                className="mono"
                                                style={{
                                                    color: 'var(--color-bone-muted)',
                                                    fontSize: 11,
                                                    marginTop: 2,
                                                }}
                                            >
                                                {formatPhone(u.phone)}
                                            </div>
                                        </td>
                                        <td
                                            className="mono"
                                            style={{ color: 'var(--color-bone-dim)', fontSize: 12 }}
                                        >
                                            {formatCpf(u.cpf)}
                                        </td>
                                        <td>
                                            {u.unit ? (
                                                <div>
                                                    <span
                                                        className="serif"
                                                        style={{ fontSize: 16, color: 'var(--color-bone)' }}
                                                    >
                                                        {u.unit.type === 'HOUSE'
                                                            ? `Lote ${u.unit.number}`
                                                            : u.unit.number}
                                                    </span>
                                                    {u.unit.block && (
                                                        <span
                                                            className="tracking-luxe"
                                                            style={{
                                                                fontSize: 9,
                                                                color: 'var(--color-bone-muted)',
                                                                marginLeft: 8,
                                                            }}
                                                        >
                                                            {u.unit.block}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span style={{ color: 'var(--color-bone-muted)' }}>—</span>
                                            )}
                                        </td>
                                        <td>
                                            <Tag
                                                tone={
                                                    u.role === 'ADMIN'
                                                        ? 'gold'
                                                        : u.role === 'FUNCIONARIO'
                                                          ? 'neutral'
                                                          : 'purple'
                                                }
                                            >
                                                {ROLE_LABELS[u.role]}
                                            </Tag>
                                        </td>
                                        <td>
                                            <Tag tone={u.status === 'ACTIVE' ? 'ok' : 'err'} dot>
                                                {STATUS_LABELS[u.status]}
                                            </Tag>
                                        </td>
                                        <td>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    gap: 4,
                                                    justifyContent: 'flex-end',
                                                }}
                                            >
                                                <IconBtn icon={<Edit3 size={14} />} onClick={() => handleEdit(u)} title="Editar residente" />
                                                <IconBtn
                                                    icon={<Trash2 size={14} />}
                                                    danger
                                                    onClick={() => setDeletingUser(u)}
                                                    title="Excluir residente"
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </PageBody>

            {/* Delete modal */}
            <DeleteModal
                open={!!deletingUser}
                isDeleting={isDeleting}
                title="Remover residente"
                description={
                    deletingUser ? (
                        <>
                            Tem certeza que deseja remover{' '}
                            <strong style={{ color: 'var(--color-bone)' }}>{deletingUser.name}</strong>? Esta ação
                            não pode ser desfeita.
                        </>
                    ) : null
                }
                onClose={() => setDeletingUser(null)}
                onConfirm={handleDelete}
            />

            <UserFormModal
                isOpen={isModalOpen}
                user={editingUser}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingUser(null);
                }}
                onSuccess={() => {
                    setIsModalOpen(false);
                    setEditingUser(null);
                    loadUsers();
                }}
            />
        </div>
    );
}

