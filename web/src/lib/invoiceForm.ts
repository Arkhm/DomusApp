import axios from 'axios';
import { apiErrorMessage } from './apiError';
import type { InvoiceDraft, InvoiceType } from '../types/invoice';
import { formatUnitDisplay, type User } from '../types/user';

/** Campos comuns da emissão individual e em lote, como o usuário os digita. */
export interface DraftFields {
    type: InvoiceType;
    description: string;
    /** Texto digitado ("350,00"). */
    amount: string;
    /** AAAA-MM-DD */
    dueDate: string;
    /** AAAA-MM (opcional) */
    referenceMonth: string;
}

export const EMPTY_DRAFT: DraftFields = { type: 'MONTHLY_FEE', description: '', amount: '', dueDate: '', referenceMonth: '' };
export type DraftErrors = Partial<Record<keyof DraftFields, string>>;

const MAX_AMOUNT = 99999999.99;

/**
 * Converte o valor digitado em texto decimal com ponto ("1.234,5" → "1234.50"),
 * o formato que a API exige. Nunca passa por número de ponto flutuante na saída.
 */
export function parseAmount(input: string): { value: string; error?: undefined } | { value?: undefined; error: string } {
    let text = input.replace(/\s|R\$/g, '');
    if (!text) return { error: 'Informe o valor.' };
    if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '');
    if (!/^\d+(\.\d{1,2})?$/.test(text)) return { error: 'Use um valor como 350,00 (até duas casas decimais).' };
    const [whole, cents = ''] = text.split('.');
    const normalized = `${whole.replace(/^0+(?=\d)/, '')}.${cents.padEnd(2, '0')}`;
    if (Number(normalized) <= 0) return { error: 'O valor deve ser maior que zero.' };
    if (Number(normalized) > MAX_AMOUNT) return { error: 'O valor máximo é R$ 99.999.999,99.' };
    return { value: normalized };
}

/** Valida os campos comuns e devolve o corpo pronto para a API. */
export function validateDraft(fields: DraftFields): { draft: InvoiceDraft | null; errors: DraftErrors } {
    const errors: DraftErrors = {};
    const description = fields.description.trim();
    if (!description) errors.description = 'Informe a descrição.';
    else if (description.length > 191) errors.description = 'Use até 191 caracteres.';
    const amount = parseAmount(fields.amount);
    if (amount.error) errors.amount = amount.error;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.dueDate) || fields.dueDate < '2000-01-01') errors.dueDate = 'Informe uma data de vencimento válida.';
    if (fields.referenceMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(fields.referenceMonth)) errors.referenceMonth = 'Use o formato AAAA-MM.';
    if (Object.keys(errors).length) return { draft: null, errors };
    return {
        errors,
        draft: {
            type: fields.type,
            description,
            amount: amount.value!,
            dueDate: fields.dueDate,
            referenceMonth: fields.referenceMonth ? `${fields.referenceMonth}-01` : null,
        },
    };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Espelha as exigências da API para o pagador. Quando uma delas falha no
 * lote, a API recusa a emissão inteira com uma mensagem genérica; por isso a
 * tela separa antes quem não pode receber cobrança.
 */
export function payerIssue(user: User): string | null {
    if (user.status !== 'ACTIVE') return 'cadastro inativo';
    if (!user.unitId || !user.unit) return 'sem unidade vinculada';
    if (!user.name.trim()) return 'sem nome';
    if (!EMAIL.test(user.email)) return 'e-mail inválido';
    if (!/^\d{11}$/.test(user.cpf.replace(/\D/g, ''))) return 'CPF inválido';
    return null;
}

export interface BlockedResident { user: User; reason: string }

/** Separa os moradores que podem receber cobrança dos que precisam de correção cadastral. */
export function splitResidents(users: User[]): { eligible: User[]; blocked: BlockedResident[] } {
    const residents = users.filter(user => user.role === 'MORADOR').sort(compareResidents);
    const eligible: User[] = [];
    const blocked: BlockedResident[] = [];
    for (const user of residents) {
        const reason = payerIssue(user);
        if (reason) blocked.push({ user, reason });
        else eligible.push(user);
    }
    return { eligible, blocked };
}

function compareResidents(a: User, b: User) {
    return formatUnitDisplay(a.unit).localeCompare(formatUnitDisplay(b.unit), 'pt-BR', { numeric: true })
        || a.name.localeCompare(b.name, 'pt-BR');
}

/** Rótulo "Nome · Unidade" usado nas listas de moradores. */
export function residentLabel(user: User): string {
    return `${user.name} · ${formatUnitDisplay(user.unit)}`;
}

/** Multiplica um valor decimal ("350.00") por um inteiro, em centavos, sem ponto flutuante. */
export function multiplyAmount(amount: string, times: number): string {
    const [whole, cents = '00'] = amount.split('.');
    const total = (BigInt(whole) * BigInt(100) + BigInt(cents.padEnd(2, '0').slice(0, 2))) * BigInt(times);
    const digits = total.toString().padStart(3, '0');
    return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

/** Mensagem para o usuário quando a emissão falha, com o que ele deve fazer em cada caso. */
export function emissionErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        if (!error.response) {
            return 'Sem resposta do servidor. A emissão pode ter sido registrada: confira a lista antes de tentar de novo. '
                + 'Reenviar os mesmos dados não duplica a cobrança.';
        }
        const { status, data } = error.response as { status: number; data?: { error?: string; code?: string } };
        if (status === 409 && /Idempotency-Key/i.test(data?.error ?? '')) {
            return 'Esta emissão já foi enviada com dados diferentes. Feche o formulário e tente de novo.';
        }
        if (status === 503 && (data?.code === 'PAYMENT_CONFIG' || data?.code === 'WEBHOOK_CONFIG' || data?.code === 'ACCOUNT_MISMATCH')) {
            return `${data.error} Peça à equipe técnica para revisar a configuração do Mercado Pago.`;
        }
    }
    return apiErrorMessage(error, 'Erro ao emitir a cobrança.');
}
