import { useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { formatDateTimeBR } from '../../lib/invoiceFormat';
import { copyText, pixImageSource, safeHttpsUrl } from '../../lib/pix';
import type { Invoice } from '../../types/invoice';

/** Pix ativo da cobrança: QR Code, código "copia e cola" e validade. Não aparece quando não há Pix ativo. */
export default function InvoicePixPanel({ invoice }: { invoice: Invoice }) {
    const { qrCode, qrCodeBase64, ticketUrl } = invoice.paymentData;
    const [copy, setCopy] = useState<'idle' | 'ok' | 'fail'>('idle');
    const image = pixImageSource(qrCodeBase64);
    const link = safeHttpsUrl(ticketUrl);
    if (!qrCode && !image && !link) return null;

    async function copyCode() {
        if (qrCode) setCopy(await copyText(qrCode) ? 'ok' : 'fail');
    }

    return (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {image && <img src={image} alt="QR Code do Pix" width={160} height={160} style={{ background: '#fff', padding: 6, border: '1px solid var(--color-line)' }} />}
            <div style={{ flex: '1 1 260px', minWidth: 0, display: 'grid', gap: 8 }}>
                {invoice.paymentExpiresAt && (
                    <p style={{ margin: 0, fontSize: 13 }}>Válido até {formatDateTimeBR(invoice.paymentExpiresAt)}</p>
                )}
                {qrCode && <>
                    <label style={{ fontSize: 12, color: 'var(--color-bone-muted)' }}>Pix copia e cola
                        <textarea readOnly className="luxe-input" rows={3} value={qrCode} style={{ fontSize: 12, wordBreak: 'break-all' }}
                            onFocus={event => event.currentTarget.select()} />
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <button type="button" className="btn-ghost" onClick={() => void copyCode()}><Copy size={14} /> Copiar código</button>
                        <span role="status" style={{ fontSize: 12, color: copy === 'fail' ? 'var(--color-err)' : 'var(--color-ok)' }}>
                            {copy === 'ok' ? 'Código copiado.' : copy === 'fail' ? 'Não foi possível copiar. Selecione o código e copie manualmente.' : ''}
                        </span>
                    </div>
                </>}
                {link && <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <ExternalLink size={14} /> Abrir no Mercado Pago
                </a>}
            </div>
        </div>
    );
}
