import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Search, Filter, Loader2, Trash2, Home } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import PageBody from '../../components/luxury/PageBody';
import { unitService } from '../../services/unitService';
import { userService } from '../../services/userService';
import type { Unit, User, UnitType } from '../../types/user';
import { UNIT_FIELD_LABELS } from '../../types/user';
import UnitFormModal from './UnitFormModal';
import {
    FilterSelect,
    ListMeta,
    IconBtn,
    EmptyTable,
    DeleteModal,
} from '../Users/UsersList';

export default function UnitsList() {
    const [units, setUnits] = useState<Unit[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBlock, setSelectedBlock] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);

    const [deletingUnit, setDeletingUnit] = useState<Unit | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const load = useCallback(async () => {
        setIsLoading(true);
        const [uR, usR] = await Promise.allSettled([unitService.getAll(), userService.getAll()]);
        if (uR.status === 'fulfilled') setUnits(uR.value);
        else toast.error('Erro ao carregar unidades.');
        if (usR.status === 'fulfilled') setUsers(usR.value);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const blocks = useMemo(
        () => Array.from(new Set(units.map((u) => u.block).filter(Boolean) as string[])).sort(),
        [units],
    );

    const filtered = useMemo(() => {
        return units.filter((u) => {
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const label = `${u.block || ''} ${u.number}`.toLowerCase();
                if (!label.includes(q)) return false;
            }
            if (selectedBlock && (u.block || '') !== selectedBlock) return false;
            return true;
        });
    }, [units, searchQuery, selectedBlock]);

    const stats = useMemo(() => {
        const occupied = users.filter((r) => r.unit).length;
        const apartments = units.filter((u) => (u.type || 'APARTMENT') === 'APARTMENT').length;
        const houses = units.filter((u) => u.type === 'HOUSE').length;
        return {
            total: units.length,
            blocks: blocks.length,
            occupancy: units.length ? Math.round((occupied / units.length) * 100) : 0,
            occupied,
            apartments,
            houses,
        };
    }, [units, blocks, users]);

    const handleDelete = async () => {
        if (!deletingUnit) return;
        setIsDeleting(true);
        try {
            await unitService.delete(deletingUnit.id);
            toast.success('Unidade removida.');
            setDeletingUnit(null);
            load();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Erro ao remover unidade.');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div>
            <Header title="Unidades" eyebrow="Apartamentos · Casas" />

            <PageBody>
                {/* Top stats */}
                <section
                    className="fade-up"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 20,
                        marginBottom: 40,
                    }}
                >
                    <StatCard
                        eyebrow="Unidades"
                        value={isLoading ? '—' : stats.total}
                        footnote="No empreendimento"
                    />
                    <StatCard
                        eyebrow="Apartamentos · Casas"
                        value={isLoading ? '—' : `${stats.apartments} · ${stats.houses}`}
                        footnote={
                            stats.apartments && stats.houses
                                ? 'Empreendimento misto'
                                : stats.houses
                                  ? 'Condomínio de casas'
                                  : 'Condomínio de apartamentos'
                        }
                    />
                    <StatCard
                        eyebrow="Ocupação"
                        value={isLoading ? '—' : `${stats.occupancy}%`}
                        footnote={`${stats.occupied} unidades habitadas`}
                    />
                </section>

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
                                    placeholder="Buscar por bloco/quadra ou número…"
                                    className="luxe-input"
                                    style={{ paddingLeft: 40 }}
                                />
                            </div>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className="btn-ghost"
                                style={{
                                    background:
                                        showFilters || selectedBlock
                                            ? 'color-mix(in srgb, var(--color-metal-1) 6%, transparent)'
                                            : 'transparent',
                                }}
                            >
                                <Filter size={12} />
                                Filtros
                            </button>
                        </div>

                        <button onClick={() => setIsModalOpen(true)} className="btn-gold">
                            <Plus size={12} />
                            Nova unidade
                        </button>
                    </div>

                    {showFilters && (
                        <div
                            style={{
                                marginTop: 16,
                                padding: '20px 24px',
                                background: 'var(--color-ink-1)',
                                border: '1px solid var(--color-line-strong)',
                                borderRadius: 4,
                                display: 'flex',
                                gap: 16,
                                alignItems: 'center',
                                flexWrap: 'wrap',
                            }}
                        >
                            <FilterSelect
                                value={selectedBlock}
                                onChange={setSelectedBlock}
                                placeholder="Todos os blocos / quadras"
                                options={blocks.map((b) => ({ value: b, label: b }))}
                            />
                            {selectedBlock && (
                                <button
                                    onClick={() => setSelectedBlock('')}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--color-metal-1)',
                                        fontSize: 12,
                                        cursor: 'pointer',
                                        fontFamily: 'var(--font-sans)',
                                    }}
                                >
                                    Limpar
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <ListMeta
                    count={filtered.length}
                    singular="unidade"
                    plural="unidades"
                    filtered={!!(searchQuery || selectedBlock)}
                />

                {/* Cards */}
                {isLoading ? (
                    <div
                        className="luxe-card"
                        style={{
                            padding: 80,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 12,
                            color: 'var(--color-bone-dim)',
                        }}
                    >
                        <Loader2 size={18} className="animate-spin" />
                        <span>Carregando unidades…</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="luxe-card">
                        <EmptyTable
                            title="Nenhuma unidade encontrada"
                            hint={
                                searchQuery || selectedBlock
                                    ? 'Tente ajustar os filtros.'
                                    : 'Clique em "Nova unidade" para cadastrar a primeira.'
                            }
                        />
                    </div>
                ) : (
                    <section
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 20,
                        }}
                    >
                        {filtered.map((u, i) => {
                            const resident = users.find(
                                (r) => r.unit?.id === u.id || (r.unit?.block === u.block && r.unit?.number === u.number),
                            );
                            const unitType: UnitType = u.type || 'APARTMENT';
                            const labels = UNIT_FIELD_LABELS[unitType];
                            const eyebrowText = u.block
                                ? `${labels.eyebrow} ${blockLetter(u.block)}`
                                : unitType === 'HOUSE'
                                  ? 'Sem quadra'
                                  : 'Sem bloco';
                            // Casas exibem "Lote N"; apartamentos só o número.
                            const numberDisplay =
                                unitType === 'HOUSE' ? `${labels.numberPrefix}${u.number}` : u.number;
                            return (
                                <motion.div
                                    key={u.id}
                                    className="luxe-card fade-up"
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                    style={{ padding: 32 }}
                                >
                                    {/* Header strip */}
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'flex-start',
                                            gap: 16,
                                            marginBottom: 28,
                                        }}
                                    >
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div
                                                className="tracking-luxe"
                                                title={eyebrowText}
                                                style={{
                                                    fontSize: 9,
                                                    color: 'var(--color-metal-1)',
                                                    marginBottom: 6,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {eyebrowText}
                                            </div>
                                            <div
                                                className="serif"
                                                title={numberDisplay}
                                                style={{
                                                    fontSize: numberFontSize(numberDisplay),
                                                    fontWeight: 300,
                                                    color: 'var(--color-bone)',
                                                    lineHeight: 1,
                                                    letterSpacing: '-0.02em',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {numberDisplay}
                                            </div>
                                        </div>
                                        {unitType === 'HOUSE' ? (
                                            <HouseMonogram />
                                        ) : (
                                            <UnitMonogram block={u.block || ''} />
                                        )}
                                    </div>

                                    <div className="gold-rule" style={{ marginBottom: 20 }} />

                                    {/* Details */}
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: 16,
                                            marginBottom: 24,
                                        }}
                                    >
                                        <Detail label={labels.block} value={u.block || '—'} />
                                        <Detail label={labels.number} value={u.number} />
                                        <Detail
                                            label="Status"
                                            value={resident ? 'Habitada' : 'Disponível'}
                                            valueColor={resident ? 'var(--color-ok)' : 'var(--color-metal-1)'}
                                        />
                                        <Detail
                                            label="Cadastro"
                                            value={
                                                u.createdAt
                                                    ? new Date(u.createdAt).toLocaleDateString('pt-BR', {
                                                          day: '2-digit',
                                                          month: 'short',
                                                      })
                                                    : '—'
                                            }
                                        />
                                    </div>

                                    {/* Resident */}
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            paddingTop: 20,
                                            borderTop: '1px solid var(--color-line)',
                                        }}
                                    >
                                        {resident ? (
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 12,
                                                    minWidth: 0,
                                                }}
                                            >
                                                <div
                                                    className="avatar"
                                                    style={{ width: 32, height: 32, fontSize: 12 }}
                                                >
                                                    {resident.name[0]?.toUpperCase()}
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div
                                                        className="tracking-luxe"
                                                        style={{
                                                            fontSize: 8,
                                                            color: 'var(--color-bone-muted)',
                                                        }}
                                                    >
                                                        Residente
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: 12,
                                                            color: 'var(--color-bone)',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        {resident.name.split(' ').slice(0, 2).join(' ')}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div
                                                className="tracking-luxe serif-it"
                                                style={{ fontSize: 11, color: 'var(--color-bone-muted)' }}
                                            >
                                                Aguardando ocupação
                                            </div>
                                        )}
                                        <IconBtn
                                            icon={<Trash2 size={14} />}
                                            danger
                                            onClick={() => setDeletingUnit(u)}
                                            title="Excluir unidade"
                                        />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </section>
                )}
            </PageBody>

            <DeleteModal
                open={!!deletingUnit}
                isDeleting={isDeleting}
                title={deletingUnit?.type === 'HOUSE' ? 'Remover casa' : 'Remover apartamento'}
                description={
                    deletingUnit ? (
                        <>
                            Tem certeza que deseja remover{' '}
                            <strong style={{ color: 'var(--color-bone)' }}>
                                {deletingUnit.type === 'HOUSE'
                                    ? `${deletingUnit.block ? `${deletingUnit.block} · ` : ''}Lote ${deletingUnit.number}`
                                    : `${deletingUnit.block ? `${deletingUnit.block} · ` : ''}${deletingUnit.number}`}
                            </strong>
                            ? Verifique se há moradores vinculados antes de prosseguir.
                        </>
                    ) : null
                }
                onClose={() => setDeletingUnit(null)}
                onConfirm={handleDelete}
            />

            <UnitFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => {
                    setIsModalOpen(false);
                    load();
                }}
            />
        </div>
    );
}

function StatCard({ eyebrow, value, footnote }: { eyebrow: string; value: number | string; footnote: string }) {
    return (
        <div className="luxe-card" style={{ padding: 28 }}>
            <div
                className="tracking-luxe"
                style={{ fontSize: 9, color: 'var(--color-bone-muted)', marginBottom: 16 }}
            >
                {eyebrow}
            </div>
            <div
                className="serif"
                style={{
                    fontSize: 48,
                    fontWeight: 400,
                    lineHeight: 1,
                    color: 'var(--color-bone)',
                    letterSpacing: '-0.02em',
                }}
            >
                {value}
            </div>
            <div
                style={{
                    marginTop: 16,
                    fontSize: 12,
                    color: 'var(--color-bone-dim)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                }}
            >
                <span style={{ width: 16, height: 1, background: 'var(--metal-line-strong)' }} />
                {footnote}
            </div>
        </div>
    );
}

function Detail({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
    return (
        <div style={{ minWidth: 0 }}>
            <div
                className="tracking-luxe"
                style={{ fontSize: 8, color: 'var(--color-bone-muted)', marginBottom: 4 }}
            >
                {label}
            </div>
            <div
                title={value}
                style={{
                    fontSize: 13,
                    color: valueColor || 'var(--color-bone-soft)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}
            >
                {value}
            </div>
        </div>
    );
}

/**
 * Strip the "Bloco" / "Torre" prefix and any whitespace, returning just the
 * letter/number identifier (e.g. "Bloco B" → "B", "Torre 2" → "2", "C" → "C").
 */
function blockLetter(raw: string | null | undefined): string {
    if (!raw) return '·';
    const cleaned = raw.replace(/^(bloco|torre|quadra|setor)\s+/i, '').trim();
    return cleaned || '·';
}

/**
 * Compact representation that always fits the 44×44 monogram box:
 * one-character identifiers stay as-is; longer strings collapse to first letter
 * + initial of the next word, or just the first 2 chars if there's no second word.
 */
/**
 * Step-down font scale for the big unit number so absurd values (e.g. "12321321312")
 * don't blow the card width. Above 10 chars we fall back to ellipsis at the smallest size.
 */
function numberFontSize(value: string): number {
    const len = value?.length ?? 0;
    if (len <= 4) return 48;
    if (len <= 6) return 38;
    if (len <= 8) return 30;
    return 24;
}

function monogramText(raw: string | null | undefined): string {
    const letter = blockLetter(raw);
    if (letter.length <= 2) return letter.toUpperCase();
    const parts = letter.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return letter.slice(0, 2).toUpperCase();
}

function UnitMonogram({ block }: { block: string }) {
    const text = monogramText(block);
    return (
        <div
            title={block || undefined}
            style={{
                width: 44,
                height: 44,
                border: '1px solid var(--metal-line-strong)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'color-mix(in srgb, var(--color-metal-1) 8%, transparent)',
                borderRadius: 2,
                flexShrink: 0,
                overflow: 'hidden',
            }}
        >
            <span
                className="serif"
                style={{
                    fontSize: text.length > 1 ? 18 : 22,
                    color: 'var(--color-metal-1)',
                    fontWeight: 500,
                    lineHeight: 1,
                    letterSpacing: '-0.02em',
                }}
            >
                {text}
            </span>
        </div>
    );
}

/** Variante do monograma para casas — ícone de casa em vez de letra do bloco. */
function HouseMonogram() {
    return (
        <div
            title="Casa"
            style={{
                width: 44,
                height: 44,
                border: '1px solid var(--metal-line-strong)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'color-mix(in srgb, var(--color-metal-1) 8%, transparent)',
                borderRadius: 2,
                flexShrink: 0,
                color: 'var(--color-metal-1)',
            }}
        >
            <Home size={20} strokeWidth={1.4} />
        </div>
    );
}
