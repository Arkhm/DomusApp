import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText, pixImageSource, safeHttpsUrl } from './pix';

describe('pixImageSource', () => {
    it('transforma base64 puro em imagem PNG, ignorando quebras de linha', () => {
        expect(pixImageSource('iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
        expect(pixImageSource('iVBO\nRw0K\n Ggo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
    });

    it('recusa qualquer coisa que não seja base64 puro (nada do provedor vai solto para o atributo)', () => {
        for (const bad of ['"><script>alert(1)</script>', 'abc" onerror="x', 'javascript:alert(1)', 'abc def!', 'a=b=c', '=abc']) {
            expect(pixImageSource(bad), bad).toBeNull();
        }
    });

    it('recusa vazio, ausente e tamanho absurdo', () => {
        expect(pixImageSource('')).toBeNull();
        expect(pixImageSource(null)).toBeNull();
        expect(pixImageSource(undefined)).toBeNull();
        expect(pixImageSource('A'.repeat(200_001))).toBeNull();
    });
});

describe('copyText', () => {
    afterEach(() => { vi.unstubAllGlobals(); });

    it('usa a área de transferência quando disponível', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        expect(await copyText('00020126')).toBe(true);
        expect(writeText).toHaveBeenCalledWith('00020126');
    });

    it('devolve false, sem lançar erro, quando nada funciona', async () => {
        vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('negado')) } });
        expect(await copyText('x')).toBe(false); // sem DOM no ambiente de teste, o método antigo também falha
    });
});

describe('safeHttpsUrl', () => {
    it('aceita só endereço HTTPS', () => {
        expect(safeHttpsUrl('https://www.mercadopago.com.br/sandbox/payments/123/ticket')).toBe('https://www.mercadopago.com.br/sandbox/payments/123/ticket');
    });

    it('descarta outros esquemas, texto solto e vazio', () => {
        for (const bad of ['javascript:alert(1)', 'data:text/html;base64,AAAA', 'http://exemplo.com', 'ftp://exemplo.com', 'exemplo.com/ticket', '', null, undefined]) {
            expect(safeHttpsUrl(bad), String(bad)).toBeNull();
        }
    });
});
