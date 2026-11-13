import { TriangleAlert } from 'lucide-react';
import { formatMoneyBR } from '../../lib/invoiceFormat';
import type { BlockedResident } from '../../lib/invoiceForm';
import type { Invoice } from '../../types/invoice';

const noteStyle = {
    display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', fontSize: 13, lineHeight: 1.5,
    color: 'var(--color-bone)', border: '1px solid color-mix(in srgb, var(--color-warn) 35%, transparent)',
    background: 'color-mix(in srgb, var(--color-warn) 10%, transparent)',
} as const;

/**
 * Em ambiente de teste a API gera todo Pix com valor fixo (R$ 50,00), seja qual
 * for o valor da cobrança. O aviso evita que isso pareça um erro de valor.
 */
export function TestEnvironmentNotice({ invoices }: { invoices: Invoice[] }) {
    const test = invoices.find(invoice => invoice.paymentEnvironment === 'TEST');
    if (!test) return null;
    return (
        <p role="note" style={noteStyle}>
            <TriangleAlert size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
                <strong>Ambiente de teste do Mercado Pago.</strong> Os Pix são gerados com o valor de{' '}
                {formatMoneyBR(test.paymentAmount ?? '50.00')}, qualquer que seja o valor da cobrança, e nenhum dinheiro real é cobrado.
            </span>
        </p>
    );
}

/** Moradores que ficaram de fora da emissão, com o motivo, para que a administração corrija o cadastro. */
export function BlockedResidents({ blocked }: { blocked: BlockedResident[] }) {
    if (!blocked.length) return null;
    return (
        <details style={{ fontSize: 12, color: 'var(--color-bone-muted)' }}>
            <summary style={{ cursor: 'pointer' }}>
                {blocked.length} {blocked.length === 1 ? 'morador não pode receber cobrança' : 'moradores não podem receber cobrança'}
            </summary>
            <ul style={{ margin: '8px 0 0', padding: 0, display: 'grid', gap: 4 }}>
                {blocked.map(({ user, reason }) => <li key={user.id}>{user.name}: {reason}. Corrija o cadastro em Residentes.</li>)}
            </ul>
        </details>
    );
}
