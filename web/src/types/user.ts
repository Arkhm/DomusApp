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
