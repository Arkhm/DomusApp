export interface User {
    id: string;
    name: string;
    email: string;
    cpf: string;
    telefone: string | null;
    perfil: UserPerfil;
    unidade: string | null;
    status: UserStatus;
    is_sindico: boolean;
    is_conselheiro: boolean;
    createdAt: string;
    updatedAt: string;
}

export type UserPerfil = 'morador' | 'administrador' | 'funcionario';
export type UserStatus = 'ativo' | 'inativo';

export interface UserFormData {
    name: string;
    email: string;
    cpf: string;
    telefone: string;
    password?: string;
    perfil: UserPerfil;
    unidade?: string;
    status: UserStatus;
    is_sindico: boolean;
    is_conselheiro: boolean;
}

export const PERFIL_LABELS: Record<UserPerfil, string> = {
    morador: 'Morador',
    administrador: 'Administrador',
    funcionario: 'Funcionário',
};

export const STATUS_LABELS: Record<UserStatus, string> = {
    ativo: 'Ativo',
    inativo: 'Inativo',
};

// ──────────────────────────────────────────────────
// API Adapter Layer — translates backend ↔ frontend
// ──────────────────────────────────────────────────

/** Raw shape returned by GET /users and GET /users/:id */
export interface ApiUser {
    id: string;
    name: string;
    email: string;
    cpf: string;
    phone: string | null;
    role: string;         // MORADOR | ADMIN | FUNCIONARIO
    status: string;       // ACTIVE | INACTIVE
    isSyndic: boolean;
    isCouncilMember: boolean;
    unitId: string | null;
    unit: { id: string; block: string | null; number: string } | null;
    createdAt: string;
    updatedAt: string;
}

const ROLE_TO_PERFIL: Record<string, UserPerfil> = {
    MORADOR: 'morador',
    ADMIN: 'administrador',
    FUNCIONARIO: 'funcionario',
};

const STATUS_API_TO_FRONT: Record<string, UserStatus> = {
    ACTIVE: 'ativo',
    INACTIVE: 'inativo',
};

/** Convert API response → frontend User */
export function mapUserFromApi(apiUser: ApiUser): User {
    // Build display string for unidade from the unit relation
    let unidade: string | null = null;
    if (apiUser.unit) {
        unidade = apiUser.unit.block
            ? `${apiUser.unit.block} - ${apiUser.unit.number}`
            : apiUser.unit.number;
    }

    return {
        id: apiUser.id,
        name: apiUser.name,
        email: apiUser.email,
        cpf: apiUser.cpf,
        telefone: apiUser.phone,
        perfil: ROLE_TO_PERFIL[apiUser.role] || 'morador',
        unidade,
        status: STATUS_API_TO_FRONT[apiUser.status] || 'ativo',
        is_sindico: apiUser.isSyndic,
        is_conselheiro: apiUser.isCouncilMember,
        createdAt: apiUser.createdAt,
        updatedAt: apiUser.updatedAt,
    };
}

const PERFIL_TO_ROLE: Record<UserPerfil, string> = {
    morador: 'MORADOR',
    administrador: 'ADMIN',
    funcionario: 'FUNCIONARIO',
};

const STATUS_FRONT_TO_API: Record<UserStatus, string> = {
    ativo: 'ACTIVE',
    inativo: 'INACTIVE',
};

/** Convert frontend form data → API payload for create/update */
export function mapUserToApi(formData: any): Record<string, any> {
    return {
        name: formData.name,
        email: formData.email,
        cpf: formData.cpf,
        phone: formData.telefone || null,
        password: formData.password || undefined,
        perfil: formData.perfil,               // backend translates perfil → role
        status: STATUS_FRONT_TO_API[formData.status as UserStatus] || 'ACTIVE',
        isSyndic: formData.is_sindico ?? false,
        isCouncilMember: formData.is_conselheiro ?? false,
        unidade: formData.unidade || null,     // sent as-is, backend handles
    };
}
