export type UserRole = 'MORADOR' | 'ADMIN' | 'FUNCIONARIO';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface Unit {
    id: string;
    block: string | null;
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

/** Format unit object as display string */
export function formatUnitDisplay(unit: Unit | null | undefined): string {
    if (!unit) return '—';
    return unit.block ? `${unit.block} - ${unit.number}` : unit.number;
}
