/** Shared formatters used across luxury pages */

export function formatCpf(cpf: string | null | undefined): string {
    const c = String(cpf || '').replace(/\D/g, '');
    if (c.length !== 11) return cpf || '—';
    return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
}

export function formatPhone(tel: string | null | undefined): string {
    if (!tel) return '—';
    const c = String(tel).replace(/\D/g, '');
    if (c.length === 11) return `(${c.slice(0, 2)}) ${c.slice(2, 7)}-${c.slice(7)}`;
    if (c.length === 10) return `(${c.slice(0, 2)}) ${c.slice(2, 6)}-${c.slice(6)}`;
    return tel;
}

export function formatDateBR(value: string): string {
    const d = new Date(value);
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(d);
}

export function formatDateTimeBR(value: string): string {
    const d = new Date(value);
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    }).format(d);
}

export function timeAgo(value: string): string {
    const ms = Date.now() - new Date(value).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'agora mesmo';
    if (m < 60) return `há ${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `há ${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `há ${d}d`;
    return formatDateBR(value);
}

export function getInitials(name: string | null | undefined): string {
    if (!name) return '?';
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || '')
        .join('') || '?';
}

/**
 * Rótulo único do papel de um usuário no condomínio.
 * Regra: a função honorífica (isSyndic) tem precedência sobre o papel de
 * sistema. Síndico > Administração > Equipe > Residente.
 * Centralizado aqui pra Sidebar e Header não divergirem nos rótulos.
 */
export function roleLabel(user: {
    role?: string | null;
    isSyndic?: boolean | null;
} | null | undefined): string {
    if (!user) return 'Residente';
    if (user.isSyndic) return 'Síndico';
    if (user.role === 'ADMIN') return 'Administração';
    if (user.role === 'FUNCIONARIO') return 'Equipe';
    return 'Residente';
}

/**
 * Validate a Brazilian CPF using the official 2-digit checksum algorithm.
 * Accepts any input (masked or unmasked); strips non-digits before checking.
 */
export function isValidCpf(input: string | null | undefined): boolean {
    if (!input) return false;
    const cpf = String(input).replace(/\D/g, '');
    if (cpf.length !== 11) return false;
    // Reject all-equal sequences (00000000000, 11111111111, …) — pass the length test but invalid.
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    // First check digit: weights 10..2 over the first 9 digits.
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
    let rest = sum % 11;
    const d1 = rest < 2 ? 0 : 11 - rest;
    if (d1 !== parseInt(cpf[9], 10)) return false;

    // Second check digit: weights 11..2 over the first 10 digits.
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
    rest = sum % 11;
    const d2 = rest < 2 ? 0 : 11 - rest;
    return d2 === parseInt(cpf[10], 10);
}
