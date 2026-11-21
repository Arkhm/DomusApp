import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Invoice } from '../types/invoice';
import { runInvoiceAction } from './runInvoiceAction';

const { reconcile, retry, setStatus } = vi.hoisted(() => ({ reconcile: vi.fn(), retry: vi.fn(), setStatus: vi.fn() }));
vi.mock('../services/invoiceService', () => ({ invoiceService: { reconcile, retry, setStatus } }));

describe('runInvoiceAction', () => {
    const updated = { id: 'inv1' } as Invoice;
    beforeEach(() => {
        for (const mock of [reconcile, retry, setStatus]) mock.mockReset().mockResolvedValue(updated);
    });

    it('conciliar e reenviar chamam o endpoint próprio, com a justificativa', async () => {
        expect(await runInvoiceAction('reconcile', 'inv1', 'conferir o Pix')).toBe(updated);
        expect(reconcile).toHaveBeenCalledWith('inv1', 'conferir o Pix');
        await runInvoiceAction('retry', 'inv1', 'tentar de novo');
        expect(retry).toHaveBeenCalledWith('inv1', 'tentar de novo');
        expect(setStatus).not.toHaveBeenCalled();
    });

    it('marcar como paga envia PAID e cancelar envia CANCELLED (nunca trocados)', async () => {
        await runInvoiceAction('markPaid', 'inv1', 'pagou em dinheiro');
        expect(setStatus).toHaveBeenLastCalledWith('inv1', 'PAID', 'pagou em dinheiro');
        await runInvoiceAction('cancel', 'inv1', 'emitida por engano');
        expect(setStatus).toHaveBeenLastCalledWith('inv1', 'CANCELLED', 'emitida por engano');
        expect(reconcile).not.toHaveBeenCalled();
        expect(retry).not.toHaveBeenCalled();
    });

    it('repassa a falha da API para quem chamou tratar', async () => {
        setStatus.mockRejectedValueOnce(new Error('falhou'));
        await expect(runInvoiceAction('markPaid', 'inv1', 'motivo')).rejects.toThrow('falhou');
    });
});
