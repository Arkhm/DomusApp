import LuxuryModal from '../luxury/LuxuryModal';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronRight, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
type Item = { id: string; type: 'NOTICE' | 'EVENT' | 'INCIDENT' | 'INVOICE' | 'RESERVATION' | 'VOTING'; eventId?: string; sourceId: string; title: string; description: string; isRead: boolean };
export default function NotificationBell() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const active = useRef(true);
    const root = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
    const [open, setOpen] = useState(false);
    const [inbox, setInbox] = useState<{ userId: string; items: Item[] } | null>(null);
    const [detail, setDetail] = useState<{ title: string; content: string; item: Item } | null>(null);
    const [opening, setOpening] = useState(false);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        let active = true;
        const load = async () => {
            if (document.hidden || !user) return;
            try { const { data } = await api.get<Item[]>('/notifications'); if (active) { setInbox({ userId: user.id, items: data }); setError(''); } }
            catch { if (active) setError('Não foi possível atualizar notificações.'); }
        };
        void load();
        const timer = window.setInterval(() => void load(), 30000);
        const focus = () => { void load(); };
        window.addEventListener('focus', focus);
        return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', focus); };
    }, [user, open, revision]);
    useEffect(() => {
        if (!open) return;
        const closeOutside = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
        document.addEventListener('mousedown', closeOutside);
        document.addEventListener('keydown', escape);
        return () => { document.removeEventListener('mousedown', closeOutside); document.removeEventListener('keydown', escape); };
    }, [open]);
    const items = inbox?.userId === user?.id ? inbox?.items ?? [] : [];
    async function read(item: Item) {
        if (opening) return;
        setOpening(true); setError('');
        try {
            const endpoint = { NOTICE: '/notices', EVENT: '/events', INCIDENT: '/incidents', INVOICE: `/invoices/${encodeURIComponent(item.sourceId)}`, RESERVATION: '/reservations', VOTING: '/votings' }[item.type];
            const { data } = await api.get(endpoint);
            if (!active.current) return;
            const record = item.type === 'INVOICE' ? data : data.find((value: { id: string }) => value.id === item.sourceId);
            if (!record) throw new Error('Conteúdo indisponível');
            if (item.type !== 'INVOICE') { setOpen(false); setDetail({ item, title: record.title ?? record.description ?? record.commonArea?.name, content: record.content ?? [record.description, record.response, record.status, record.rejectionReason].filter(Boolean).join(' — ') }); }
            await api.post(item.eventId ? `/notifications/inbox/${item.eventId}/read` : `/notifications/${item.type}/${encodeURIComponent(item.sourceId)}/read`);
            if (item.type === 'INVOICE') { setOpen(false); navigate(`/cobrancas?invoice=${encodeURIComponent(item.sourceId)}`); }
            if (active.current) setRevision(value => value + 1);
        } catch { if (active.current) setError('Não foi possível abrir a notificação. Tente novamente.'); } finally { if (active.current) setOpening(false); }
    }
    const unread = items.filter(item => !item.isRead).length;
    return <div ref={root} style={{ position: 'relative' }}>
        <button ref={trigger} type="button" className="btn-ghost" aria-expanded={open} aria-controls="notification-inbox" aria-label={`Notificações: ${unread} não lidas`} onClick={() => setOpen(value => !value)}><Bell size={18} />{unread || ''}</button>
        {open && <section id="notification-inbox" aria-label="Notificações" className="luxe-card notification-inbox">
            <div className="notification-inbox-header">
                <div><h2 className="serif" style={{ fontSize: 24, margin: 0 }}>Notificações</h2><p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-bone-muted)' }}>{unread} {unread === 1 ? 'não lida' : 'não lidas'}</p></div>
                <button type="button" className="btn-ghost" aria-label="Atualizar notificações" onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} /></button>
            </div>
            {error && <p role="alert" className="notification-message">{error}</p>}
            {!inbox && !error && <p role="status" className="notification-message">Carregando…</p>}
            {inbox && !items.length && <p className="notification-message">Nenhuma notificação por enquanto.</p>}
            <ul className="notification-items">
                {items.map(item => <li key={item.id}>
                    <button type="button" className={`notification-item${item.isRead ? '' : ' notification-item-unread'}`} disabled={opening} onClick={() => void read(item)}>
                        <span className="notification-item-icon" aria-hidden="true"><Bell size={16} /></span>
                        <span className="notification-item-copy"><span className="notification-item-title">{item.title}</span><span className="notification-item-description">{item.description}</span><span className="notification-item-state">{item.isRead ? 'Lida' : 'Não lida'}</span></span>
                        <ChevronRight size={15} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--color-bone-muted)' }} />
                    </button>
                </li>)}
            </ul>
        </section>}
        {detail && createPortal(<LuxuryModal open onClose={() => { setDetail(null); trigger.current?.focus(); }} icon={<Bell size={18} />} title="Notificação" subtitle={detail.item.description} size="lg">
            <div style={{ padding: 28 }}>
                <article className="notification-detail"><h3 style={{ margin: '0 0 16px', fontSize: 20, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{detail.title}</h3><p>{detail.content}</p></article>
                {error && <div role="alert"><p>{error}</p><button type="button" className="btn-ghost" disabled={opening} onClick={() => void read(detail.item)}>Tentar novamente</button></div>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}><button type="button" className="btn-ghost" onClick={() => { setDetail(null); setOpen(true); }}>Voltar às notificações</button></div>
            </div>
        </LuxuryModal>, document.body)}
    </div>;
}
