import { useEffect, useState } from 'react';
import { invoiceService } from '../../services/invoiceService';
export default function PaymentHealth({ revision }: { revision: Date }) {
    const [health, setHealth] = useState<Record<string, number | string | null> | null>(null);
    const [error, setError] = useState(false);
    useEffect(() => {
        let active = true;
        invoiceService.health().then(data => { if (active) { setHealth(data); setError(false); } }).catch(() => { if (active) setError(true); });
        return () => { active = false; };
    }, [revision]);
    if (error) return <p role="alert">Não foi possível consultar as pendências financeiras. Use Atualizar para tentar novamente.</p>;
    if (!health) return null;
    return <p role="status">Pendências financeiras: {health.paymentsForReview} para revisão · {health.uncertainPayments} emissões em andamento · {health.pendingWebhooks} confirmações aguardando processamento · {health.failedWebhooks} confirmações exigindo revisão.</p>;
}
