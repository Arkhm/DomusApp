import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
type Item = { id: string; type: 'NOTICE' | 'EVENT' | 'INCIDENT' | 'INVOICE' | 'RESERVATION' | 'VOTING'; eventId?: string; sourceId: string; title: string; description: string; isRead: boolean };
export default function NotificationBell() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const active = useRef(true);
    useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
    const [open, setOpen] = useState(false);
    const [inbox, setInbox] = useState<{ userId: string; items: Item[] } | null>(null);
    const [detail, setDetail] = useState<{ title: string; content: string } | null>(null);
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
    const items = inbox?.userId === user?.id ? inbox?.items ?? [] : [];
    async function read(item: Item) {
        if (opening) return;
        setOpening(true);
        try {
            const endpoint = { NOTICE: '/notices', EVENT: '/events', INCIDENT: '/incidents', INVOICE: `/invoices/${encodeURIComponent(item.sourceId)}`, RESERVATION: '/reservations', VOTING: '/votings' }[item.type];
            const { data } = await api.get(endpoint);
            if (!active.current) return;
            const record = item.type === 'INVOICE' ? data : data.find((value: { id: string }) => value.id === item.sourceId);
            if (!record) throw new Error('Conteúdo indisponível');
            setDetail({ title: record.title ?? record.description ?? record.commonArea?.name, content: record.content ?? [record.description, record.response, record.status, record.rejectionReason].filter(Boolean).join(' — ') });
            await api.post(item.eventId ? `/notifications/inbox/${item.eventId}/read` : `/notifications/${item.type}/${encodeURIComponent(item.sourceId)}/read`);
            if (item.type === 'INVOICE') { setOpen(false); navigate(`/cobrancas?invoice=${encodeURIComponent(item.sourceId)}`); }
            if (active.current) setRevision(value => value + 1);
        } catch { if (active.current) setError('Não foi possível abrir a notificação. Tente novamente.'); } finally { if (active.current) setOpening(false); }
    }
    return <div style={{ position: 'relative' }}>
        <button type="button" className="btn-ghost" aria-expanded={open} aria-label={`Notificações: ${items.filter(i => !i.isRead).length} não lidas`} onClick={() => setOpen(value => !value)}><Bell size={18} />{items.filter(i => !i.isRead).length || ''}</button>
        {open && <div className="luxe-card" style={{ position: 'absolute', right: 0, top: '100%', width: 340, maxHeight: '70vh', overflowY: 'auto', padding: 16 }}>
            <h2>Notificações</h2>{detail && <article><h3>{detail.title}</h3><p style={{ whiteSpace: 'pre-wrap' }}>{detail.content}</p><button onClick={() => setDetail(null)}>Voltar à lista</button></article>}{error && <p role="alert">{error}</p>}
            <button onClick={() => setRevision(value => value + 1)}>Atualizar</button>
            {!inbox && !error && <p>Carregando…</p>}{inbox && !items.length && <p>Nenhuma notificação.</p>}
            {items.map(item => <button className="btn-ghost" disabled={opening} key={item.id} onClick={() => void read(item)} style={{ display: 'block', textAlign: 'left', width: '100%' }}>{!item.isRead && '● '}{item.title}<br />{item.description}</button>)}
        </div>}
    </div>;
}
