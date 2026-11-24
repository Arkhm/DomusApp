import { AxiosError, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import {
    AMOUNT_FORMAT_HINT, EMPTY_DRAFT, emissionErrorMessage, multiplyAmount, parseAmount, payerIssue,
    residentLabel, splitResidents, validateDraft, type DraftFields,
} from './invoiceForm';
import type { User } from '../types/user';

const resident = (patch: Partial<User> = {}): User => ({
    id: 'u1', name: 'Ana Souza', email: 'ana@exemplo.com', cpf: '123.456.789-01', phone: null, role: 'MORADOR',
    status: 'ACTIVE', isSyndic: false, isCouncilMember: false, unitId: 'a101',
    unit: { id: 'a101', type: 'APARTMENT', block: 'Bloco A', number: '101' }, createdAt: '', updatedAt: '', ...patch,
});

describe('parseAmount', () => {
    it.each([
        ['350,00', '350.00'], ['350', '350.00'], ['350,5', '350.50'], ['350.5', '350.50'], ['350.50', '350.50'],
        ['1.234,50', '1234.50'], ['1.234', '1234.00'], ['1.234.567,89', '1234567.89'], ['1234,50', '1234.50'],
        ['0,50', '0.50'], ['00,50', '0.50'], ['R$ 1.234,50', '1234.50'], ['  350,00  ', '350.00'],
        ['99.999.999,99', '99999999.99'],
    ])('aceita %s', (input, expected) => {
        expect(parseAmount(input)).toEqual({ value: expected });
    });

    it.each([
        '350.00,00', '1.2.3,4', '1,234.50', '1.23,45', '12.345,678', '350,', ',50', '1..234,50', '1.234,5,6', 'abc', '3 50 0,0a',
        '-350,00', '350,001', '12.34.56',
    ])('recusa o valor malformado %s em vez de reinterpretá-lo', (input) => {
        expect(parseAmount(input)).toEqual({ error: AMOUNT_FORMAT_HINT });
    });

    it('caso do review: "350.00,00" não vira 35000,00', () => {
        expect(parseAmount('350.00,00').value).toBeUndefined();
    });

    it('recusa vazio, zero e valores acima do limite da API', () => {
        expect(parseAmount('').error).toBe('Informe o valor.');
        expect(parseAmount('   ').error).toBe('Informe o valor.');
        expect(parseAmount('0').error).toBe('O valor deve ser maior que zero.');
        expect(parseAmount('0,00').error).toBe('O valor deve ser maior que zero.');
        expect(parseAmount('100.000.000,00').error).toMatch(/máximo/);
    });
});

describe('validateDraft', () => {
    const valid: DraftFields = { type: 'FINE', description: '  Multa de barulho ', amount: '80,5', dueDate: '2026-12-18', referenceMonth: '2026-12' };

    it('monta o corpo da API: texto aparado, valor decimal e mês de referência como dia 1', () => {
        expect(validateDraft(valid)).toEqual({
            errors: {},
            draft: { type: 'FINE', description: 'Multa de barulho', amount: '80.50', dueDate: '2026-12-18', referenceMonth: '2026-12-01' },
        });
    });

    it('o mês de referência é opcional', () => {
        expect(validateDraft({ ...valid, referenceMonth: '' }).draft?.referenceMonth).toBeNull();
    });

    it('acusa cada campo inválido, sem montar o corpo', () => {
        const { draft, errors } = validateDraft({ ...EMPTY_DRAFT, description: 'x'.repeat(192), amount: '350.00,00', dueDate: '1999-12-31', referenceMonth: '2026-13' });
        expect(draft).toBeNull();
        expect(Object.keys(errors).sort()).toEqual(['amount', 'description', 'dueDate', 'referenceMonth']);
    });

    it('exige descrição e data', () => {
        const { errors } = validateDraft({ ...valid, description: '   ', dueDate: '' });
        expect(errors.description).toBe('Informe a descrição.');
        expect(errors.dueDate).toBeDefined();
    });
});

describe('payerIssue', () => {
    it('aceita morador ativo, com unidade, e-mail válido e CPF de 11 dígitos (com ou sem máscara)', () => {
        expect(payerIssue(resident())).toBeNull();
        expect(payerIssue(resident({ cpf: '12345678901' }))).toBeNull();
    });

    it('explica o motivo de cada recusa, as mesmas que a API faz', () => {
        expect(payerIssue(resident({ status: 'INACTIVE' }))).toBe('cadastro inativo');
        expect(payerIssue(resident({ unitId: null, unit: null }))).toBe('sem unidade vinculada');
        expect(payerIssue(resident({ name: '   ' }))).toBe('sem nome');
        expect(payerIssue(resident({ email: 'sem-arroba' }))).toBe('e-mail inválido');
        expect(payerIssue(resident({ cpf: '123' }))).toBe('CPF inválido');
    });
});

describe('splitResidents', () => {
    it('considera só moradores, ordena por unidade e nome e separa os bloqueados com o motivo', () => {
        const ana = resident({ id: 'ana', name: 'Ana' });
        const bia = resident({ id: 'bia', name: 'Bia', unit: { id: 'a2', type: 'APARTMENT', block: 'Bloco A', number: '20' }, unitId: 'a2' });
        const carlos = resident({ id: 'carlos', name: 'Carlos', cpf: '1' });
        const admin = resident({ id: 'admin', role: 'ADMIN' });
        const { eligible, blocked } = splitResidents([bia, carlos, admin, ana]);
        // ordem numérica por unidade: o apartamento 20 vem antes do 101
        expect(eligible.map((user) => user.id)).toEqual(['bia', 'ana']);
        expect(blocked.map(({ user, reason }) => [user.id, reason])).toEqual([['carlos', 'CPF inválido']]);
    });
});

describe('residentLabel', () => {
    it('junta nome e unidade', () => {
        expect(residentLabel(resident())).toBe('Ana Souza · Bloco A · 101');
    });
});

describe('multiplyAmount', () => {
    it('multiplica em centavos, sem ponto flutuante', () => {
        expect(multiplyAmount('350.00', 8)).toBe('2800.00');
        expect(multiplyAmount('0.10', 3)).toBe('0.30');
        expect(multiplyAmount('0.01', 3)).toBe('0.03');
        expect(multiplyAmount('99999999.99', 100)).toBe('9999999999.00');
        expect(multiplyAmount('19.99', 0)).toBe('0.00');
    });
});

describe('emissionErrorMessage', () => {
    const failure = (status: number, data: unknown) =>
        new AxiosError('falhou', 'ERR_BAD_RESPONSE', undefined, undefined, { status, data } as AxiosResponse);

    it('sem resposta do servidor: avisa que pode ter sido registrada e que reenviar não duplica', () => {
        const message = emissionErrorMessage(new AxiosError('Network Error', 'ERR_NETWORK'));
        expect(message).toMatch(/Sem resposta do servidor/);
        expect(message).toMatch(/não duplica/);
    });

    it('conflito de Idempotency-Key: orienta a fechar e tentar de novo', () => {
        expect(emissionErrorMessage(failure(409, { error: 'Idempotency-Key já usada com outros dados.' }))).toMatch(/dados diferentes/);
    });

    it('configuração de pagamentos ausente: manda procurar a equipe técnica', () => {
        const message = emissionErrorMessage(failure(503, { error: 'Configuração de pagamentos incompleta.', code: 'PAYMENT_CONFIG' }));
        expect(message).toMatch(/Configuração de pagamentos incompleta\./);
        expect(message).toMatch(/equipe técnica/);
    });

    it('outros erros usam a mensagem da API', () => {
        expect(emissionErrorMessage(failure(400, { error: 'Cadastro do pagador inválido ou inativo.' }))).toBe('Cadastro do pagador inválido ou inativo.');
    });
});
