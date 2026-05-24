import type { User } from '../types/user';

/**
 * Quem tem acesso ao painel administrativo do DomusApp.
 * Espelha `api/src/lib/access.ts` — qualquer mudança aqui precisa ser
 * replicada lá. ADMIN e FUNCIONARIO têm acesso; MORADOR só se for síndica.
 */
export function hasPanelAccess(user: User | null | undefined): boolean {
    if (!user) return false;
    if (user.role === 'ADMIN' || user.role === 'FUNCIONARIO') return true;
    if (user.role === 'MORADOR' && user.isSyndic) return true;
    return false;
}
