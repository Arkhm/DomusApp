export type UserRole = 'MORADOR' | 'ADMIN' | 'FUNCIONARIO';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

/** Tipologia da unidade — define rótulos e visual no UI */
export type UnitType = 'APARTMENT' | 'HOUSE';

export interface Unit {
    id: string;
    /** Default 'APARTMENT' no backend para compat com registros antigos */
    type: UnitType;
    /** APARTMENT: Bloco/Torre · HOUSE: Quadra/Setor (opcional) */
    block: string | null;
    /** Identificador da unidade (nº do apto ou da casa) */
    number: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface User {
    id: string;
    name: string;
    email: string;
    cpf: string;
    phone: string | null;
    role: UserRole;
    status: UserStatus;
    isSyndic: boolean;
    isCouncilMember: boolean;
    unitId: string | null;
    unit: Unit | null;
    createdAt: string;
    updatedAt: string;
}

export interface UserFormData {
    name: string;
    email: string;
    cpf: string;
    phone: string;
    password?: string;
    role: UserRole;
    unitId?: string;
    status: UserStatus;
    isSyndic: boolean;
    isCouncilMember: boolean;
}

// Display labels (PT-BR for the UI)
export const ROLE_LABELS: Record<UserRole, string> = {
    MORADOR: 'Morador',
    ADMIN: 'Administrador',
    FUNCIONARIO: 'Funcionário',
};

export const STATUS_LABELS: Record<UserStatus, string> = {
    ACTIVE: 'Ativo',
    INACTIVE: 'Inativo',
};

/** Rótulos curtos para o tipo da unidade */
export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
    APARTMENT: 'Apartamento',
    HOUSE: 'Casa',
};

/**
 * Rótulos dos campos exibidos no formulário e no card, baseados no tipo:
 * - APARTMENT: "Bloco" + "Número" (ex: "Bloco A · 101")
 * - HOUSE: "Quadra" + "Lote" (ex: "Quadra 1 · Lote 12") — padrão de condomínio horizontal
 */
export const UNIT_FIELD_LABELS: Record<
    UnitType,
    { block: string; number: string; eyebrow: string; numberPrefix: string }
> = {
    APARTMENT: {
        block: 'Bloco',
        number: 'Número',
        eyebrow: 'Torre',
        numberPrefix: '',
    },
    HOUSE: {
        block: 'Quadra',
        number: 'Lote',
        eyebrow: 'Quadra',
        numberPrefix: 'Lote ',
    },
};

/** Format unit object as display string, adapting to APARTMENT vs HOUSE. */
export function formatUnitDisplay(unit: Unit | null | undefined): string {
    if (!unit) return '—';
    const type: UnitType = unit.type || 'APARTMENT';
    if (type === 'HOUSE') {
        return unit.block ? `${unit.block} · Lote ${unit.number}` : `Lote ${unit.number}`;
    }
    return unit.block ? `${unit.block} · ${unit.number}` : unit.number;
}
