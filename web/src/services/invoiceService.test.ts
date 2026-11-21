import { beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('./api', () => ({ default: api }));
import { invoiceService } from './invoiceService';
beforeEach(() => { vi.resetAllMocks(); Object.values(api).forEach(fn => fn.mockResolvedValue({ data: { id: 'invoice' } })); });
it('envia justificativa na baixa manual sem alterar o contrato de status', async () => {
    await invoiceService.action('invoice', 'paid', 'Pagamento em dinheiro');
    expect(api.put).toHaveBeenCalledWith('/invoices/invoice/status', { status: 'PAID', reason: 'Pagamento em dinheiro' });
});
it('envia justificativa no corpo do cancelamento', async () => {
    await invoiceService.action('invoice', 'cancel', 'Emissão incorreta');
    expect(api.delete).toHaveBeenCalledWith('/invoices/invoice', { data: { reason: 'Emissão incorreta' } });
});
it.each(['reconcile', 'retry'])('preserva endpoint de recuperação %s', async action => {
    await invoiceService.action('invoice', action, 'Conferência');
    expect(api.post).toHaveBeenCalledWith(`/invoices/invoice/${action}`, { reason: 'Conferência' });
});
