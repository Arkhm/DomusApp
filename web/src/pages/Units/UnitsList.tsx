import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
    Building2,
    Filter,
    Grid3X3,
    Hash,
    Loader2,
    Plus,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import { unitService } from '../../services/unitService';
import type { Unit } from '../../types/user';
import UnitFormModal from './UnitFormModal';

export default function UnitsList() {
    const [units, setUnits] = useState<Unit[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBlock, setSelectedBlock] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);

    const [deletingUnit, setDeletingUnit] = useState<Unit | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadUnits = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await unitService.getAll();
            setUnits(data);
        } catch (error: any) {
            toast.error('Erro ao carregar unidades.', {
                position: 'top-right',
                style: { background: '#16161f', color: '#f0f0f5', border: '1px solid #ef4444' },
            });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUnits();
    }, [loadUnits]);

    const uniqueBlocks = useMemo(() => {
        const blocks = Array.from(new Set(units.map((unit) => unit.block).filter(Boolean))) as string[];
        return blocks.sort((a, b) => a.localeCompare(b));
    }, [units]);

    const filteredUnits = useMemo(() => {
        let result = [...units];

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter((unit) => {
                const label = `${unit.block || ''} ${unit.number}`.toLowerCase();
                return label.includes(q);
            });
        }

        if (selectedBlock) {
            result = result.filter((unit) => (unit.block || '') === selectedBlock);
        }

        return result;
    }, [units, searchQuery, selectedBlock]);

    const stats = useMemo(() => {
        const withoutBlock = units.filter((unit) => !unit.block).length;

        return {
            total: units.length,
            blocks: uniqueBlocks.length,
            withoutBlock,
        };
    }, [units, uniqueBlocks]);

    const handleDelete = async () => {
        if (!deletingUnit) return;

        setIsDeleting(true);
        try {
            await unitService.delete(deletingUnit.id);

            toast.success('Unidade removida com sucesso!', {
                position: 'top-right',
                style: { background: '#16161f', color: '#f0f0f5', border: '1px solid #22c55e' },
                iconTheme: { primary: '#22c55e', secondary: '#16161f' },
            });

            setDeletingUnit(null);
            loadUnits();
        } catch (error: any) {
            toast.error(
                error.response?.data?.error ||
                    'Erro ao remover unidade. Verifique se há moradores vinculados.',
                {
                    position: 'top-right',
                    style: { background: '#16161f', color: '#f0f0f5', border: '1px solid #ef4444' },
                }
            );
        } finally {
            setIsDeleting(false);
        }
    };

    const formatUnitLabel = (unit: Unit) => {
        return unit.block ? `Bloco ${unit.block} • Unidade ${unit.number}` : `Unidade ${unit.number}`;
    };

    return (
        <div className="bg-bg-primary min-h-screen">
            <Header title="Unidades" />

            <div className="p-8 space-y-6">
                <motion.section
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                    <div className="rounded-2xl border border-border-primary bg-bg-card p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-text-secondary">Total de unidades</p>
                                <p className="mt-2 text-3xl font-bold text-text-primary">{stats.total}</p>
                            </div>
                            <div className="w-11 h-11 rounded-xl bg-accent-primary/10 text-accent-primary flex items-center justify-center">
                                <Building2 className="w-5 h-5" />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-border-primary bg-bg-card p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-text-secondary">Blocos cadastrados</p>
                                <p className="mt-2 text-3xl font-bold text-text-primary">{stats.blocks}</p>
                            </div>
                            <div className="w-11 h-11 rounded-xl bg-info-bg text-info flex items-center justify-center">
                                <Grid3X3 className="w-5 h-5" />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-border-primary bg-bg-card p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-text-secondary">Sem bloco informado</p>
                                <p className="mt-2 text-3xl font-bold text-text-primary">{stats.withoutBlock}</p>
                            </div>
                            <div className="w-11 h-11 rounded-xl bg-warning-bg text-warning flex items-center justify-center">
                                <Hash className="w-5 h-5" />
                            </div>
                        </div>
                    </div>
                </motion.section>

                <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 w-full">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Buscar por bloco ou número..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-2.5 bg-bg-input border border-border-primary rounded-lg text-sm text-text-primary placeholder-text-muted focus:border-accent-primary focus:outline-none transition-colors"
                            />
                        </div>

                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 ${
                                showFilters || selectedBlock
                                    ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                                    : 'bg-bg-input border-border-primary text-text-secondary hover:text-text-primary'
                            }`}
                        >
                            <Filter className="w-4 h-4" />
                            Filtros
                            {selectedBlock && (
                                <span className="w-5 h-5 bg-accent-primary text-white text-xs rounded-full flex items-center justify-center">
                                    1
                                </span>
                            )}
                        </button>
                    </div>

                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setIsModalOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-primary text-white text-sm font-medium hover:bg-accent-primary-hover transition-colors shadow-lg shadow-accent-primary/20"
                    >
                        <Plus className="w-4 h-4" />
                        Nova Unidade
                    </motion.button>
                </div>

                <AnimatePresence>
                    {showFilters && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="bg-bg-card border border-border-primary rounded-2xl p-5">
                                <div className="flex flex-col md:flex-row gap-4 md:items-end">
                                    <div className="w-full md:max-w-xs">
                                        <label className="block text-sm text-text-secondary mb-2">Bloco</label>
                                        <select
                                            value={selectedBlock}
                                            onChange={(e) => setSelectedBlock(e.target.value)}
                                            className="w-full px-4 py-3 bg-bg-input border border-border-primary rounded-xl text-text-primary focus:border-accent-primary focus:outline-none transition-colors"
                                        >
                                            <option value="">Todos os blocos</option>
                                            {uniqueBlocks.map((block) => (
                                                <option key={block} value={block}>
                                                    Bloco {block}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <button
                                        onClick={() => {
                                            setSelectedBlock('');
                                            setSearchQuery('');
                                        }}
                                        className="px-4 py-3 rounded-xl border border-border-primary text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                                    >
                                        Limpar filtros
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="bg-bg-card border border-border-primary rounded-2xl overflow-hidden">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-6 h-6 text-accent-primary animate-spin" />
                            <span className="ml-3 text-text-secondary">Carregando unidades...</span>
                        </div>
                    ) : filteredUnits.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                            <Building2 className="w-12 h-12 mb-3 opacity-30" />
                            <p className="text-base font-medium">Nenhuma unidade encontrada</p>
                            <p className="text-sm mt-1">Cadastre uma unidade ou ajuste os filtros</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
                            {filteredUnits.map((unit, index) => (
                                <motion.div
                                    key={unit.id}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.04 }}
                                    className="group rounded-2xl border border-border-primary bg-bg-secondary/50 p-5 hover:border-border-secondary transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="w-11 h-11 rounded-xl bg-accent-primary/10 text-accent-primary flex items-center justify-center mb-4">
                                                <Building2 className="w-5 h-5" />
                                            </div>

                                            <h3 className="text-base font-semibold text-text-primary">
                                                {formatUnitLabel(unit)}
                                            </h3>

                                            <div className="mt-3 space-y-1 text-sm text-text-secondary">
                                                <p>
                                                    <span className="text-text-muted">Bloco:</span>{' '}
                                                    {unit.block || 'Não informado'}
                                                </p>
                                                <p>
                                                    <span className="text-text-muted">Número:</span>{' '}
                                                    {unit.number}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setDeletingUnit(unit)}
                                            className="p-2 rounded-lg text-text-muted hover:text-error hover:bg-error-bg transition-colors opacity-0 group-hover:opacity-100"
                                            title="Excluir unidade"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {deletingUnit && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => !isDeleting && setDeletingUnit(null)}
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
                                    onClick={() => setDeletingUnit(null)}
                                    disabled={isDeleting}
                                    className="p-1 rounded-lg text-text-muted hover:text-text-primary transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <p className="text-sm text-text-secondary mb-6">
                                Tem certeza que deseja remover a unidade{' '}
                                <strong className="text-text-primary">"{formatUnitLabel(deletingUnit)}"</strong>?
                            </p>

                            <div className="flex items-center justify-end gap-3">
                                <button
                                    onClick={() => setDeletingUnit(null)}
                                    disabled={isDeleting}
                                    className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary border border-border-primary rounded-xl hover:bg-bg-hover transition-colors"
                                >
                                    Cancelar
                                </button>

                                <button
                                    onClick={handleDelete}
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

            <UnitFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => {
                    setIsModalOpen(false);
                    loadUnits();
                }}
            />
        </div>
    );
}