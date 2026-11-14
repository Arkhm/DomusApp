import { describe, expect, it } from 'vitest';
import type { User } from '../types/user';
import { hasPanelAccess } from './access';
import { apiErrorMessage } from './apiError';

const user = (role: User['role'], isSyndic = false) => ({ role, isSyndic }) as User;

describe('hasPanelAccess', () => {
    it('libera ADMIN, FUNCIONARIO e síndico; bloqueia morador comum e sessão vazia', () => {
        expect(hasPanelAccess(user('ADMIN'))).toBe(true);
        expect(hasPanelAccess(user('FUNCIONARIO'))).toBe(true);
        expect(hasPanelAccess(user('MORADOR', true))).toBe(true);
        expect(hasPanelAccess(user('MORADOR'))).toBe(false);
        expect(hasPanelAccess(null)).toBe(false);
    });
});

describe('apiErrorMessage', () => {
    it('usa a mensagem da API, depois a do Error e por fim o fallback', () => {
        expect(apiErrorMessage({ response: { data: { error: 'E-mail já cadastrado.' } } }, 'x')).toBe('E-mail já cadastrado.');
        expect(apiErrorMessage({ response: { data: { error: 42 } } }, 'Falhou')).toBe('Falhou');
        expect(apiErrorMessage(new Error('Network Error'), 'x')).toBe('Network Error');
        expect(apiErrorMessage('qualquer coisa', 'Falhou')).toBe('Falhou');
    });
});
