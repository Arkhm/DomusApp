import { useEffect, useState } from 'react';
import api from '../services/api';
import { apiErrorMessage } from '../lib/apiError';
import { useAuth } from '../hooks/useAuth';
import LuxuryModal from './luxury/LuxuryModal';
type RecordItem = { priority?: string; targetType?: string; targetUnitId?: string | null; location?: string | null; category?: string; capacity?: number | null; id: string; authorId: string; title: string; content?: string; description?: string; status?: string; eventDate?: string; startDate?: string; endDate?: string; options?: { text: string; votes?: number }[] };
export default function ContentEditor({ records, resource, onSaved }: { records: RecordItem[]; resource: 'notices' | 'events' | 'votings'; onSaved: () => void }) {
    const { user } = useAuth();
    const [deleting, setDeleting] = useState<RecordItem | null>(null);
    const [record, setRecord] = useState<RecordItem | null>(null);
    const [units, setUnits] = useState<{ id: string; block: string | null; number: string }[]>([]);
    const [unitsError, setUnitsError] = useState(false);
    useEffect(() => {
        if (resource === 'votings') return;
        let active = true;
        api.get('/units/options').then(({ data }) => { if (active) setUnits(data); }).catch(() => { if (active) setUnitsError(true); });
        return () => { active = false; };
    }, [resource]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const owned = records.filter(item => (user?.role === 'ADMIN' || (user?.role === 'MORADOR' && user.isSyndic && item.authorId === user.id)) );
    const editable = owned.filter(item => (resource !== 'votings' || (new Date(item.startDate!).getTime() > Date.now() && !item.options?.some(o => (o.votes ?? 0) > 0))));
    async function save() {
        if (!record || busy) return;
        setBusy(true); setError('');
        const payload = resource === 'votings'
            ? { title: record.title, description: record.description, startDate: record.startDate, endDate: record.endDate, options: record.options?.map(o => o.text) }
            : { title: record.title, content: record.content, status: record.status, targetType: record.targetType, targetUnitId: record.targetType === 'UNIT' ? record.targetUnitId : null, ...(resource === 'events' ? { eventDate: record.eventDate, location: record.location, capacity: record.capacity, category: record.category } : { priority: record.priority }) };
        try { await api.put(`/${resource}/${record.id}`, payload); setRecord(null); onSaved(); }
        catch (err) { setError(apiErrorMessage(err, 'Não foi possível salvar.')); }
        finally { setBusy(false); }
    }
    async function remove() {
        if (!deleting || busy) return;
        setBusy(true); setError('');
        try { await api.delete(`/${resource}/${deleting.id}`); setDeleting(null); onSaved(); }
        catch (err) { setError(apiErrorMessage(err, 'Não foi possível excluir.')); }
        finally { setBusy(false); }
    }
    if (!owned.length && !record && !deleting) return null;
    return <div style={{ marginBottom: 20 }}>
        <label>Editar registro<select className="luxe-input" value="" onChange={e => { setRecord(structuredClone(editable.find(r => r.id === e.target.value)!)); setError(''); }}><option value="">Selecione um registro</option>{editable.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
        {user?.role !== 'ADMIN' && <label>Excluir registro próprio<select className="luxe-input" value="" onChange={e => { setDeleting(owned.find(r => r.id === e.target.value) ?? null); setError(''); }}><option value="">Selecione um registro</option>{owned.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>}
        {deleting && <LuxuryModal icon={null} open busy={busy} onClose={() => setDeleting(null)} title="Confirmar exclusão"><div style={{ padding: 28 }}><p>Excluir {deleting.title}? Esta ação não pode ser desfeita.</p>{error && <p role="alert">{error}</p>}<button disabled={busy} className="btn-gold" onClick={() => void remove()}>Excluir registro</button></div></LuxuryModal>}
        {record && <LuxuryModal icon={null} open busy={busy} onClose={() => setRecord(null)} title="Editar registro" size="lg">
            <form style={{ padding: 28, display: 'grid', gap: 16 }} onSubmit={e => { e.preventDefault(); void save(); }}>
                {error && <p role="alert">{error}</p>}
                <label>Título<input className="luxe-input" required maxLength={191} value={record.title} onChange={e => setRecord({ ...record, title: e.target.value })} /></label>
                <label>{resource === 'votings' ? 'Descrição' : 'Conteúdo'}<textarea required className="luxe-input" value={record.content ?? record.description ?? ''} onChange={e => setRecord({ ...record, ...(resource === 'votings' ? { description: e.target.value } : { content: e.target.value }) })} /></label>
                {resource !== 'votings' && <label>Situação<select className="luxe-input" value={record.status} onChange={e => setRecord({ ...record, status: e.target.value })}><option value="DRAFT">Rascunho</option><option value="PUBLISHED">Publicado</option>{resource === 'events' && <option value="CANCELLED">Cancelado</option>}</select></label>}
                {resource !== 'votings' && <>
                    <label>Destinatários<select className="luxe-input" value={record.targetType} onChange={e => setRecord({ ...record, targetType: e.target.value })}><option value="ALL">Todos</option><option value="UNIT">Unidade</option></select></label>
                    {record.targetType === 'UNIT' && <label>Unidade<select required className="luxe-input" value={record.targetUnitId ?? ''} onChange={e => setRecord({ ...record, targetUnitId: e.target.value })}><option value="">Selecione</option>{units.map(u => <option key={u.id} value={u.id}>{u.block} {u.number}</option>)}</select>{unitsError && <span role="alert">Não foi possível atualizar a lista de unidades.</span>}</label>}
                </>}
                {resource === 'notices' && <label>Prioridade<select className="luxe-input" value={record.priority} onChange={e => setRecord({ ...record, priority: e.target.value })}><option value="NORMAL">Normal</option><option value="URGENT">Urgente</option></select></label>}
                {resource === 'events' && <>
                    <label>Local<input className="luxe-input" value={record.location ?? ''} onChange={e => setRecord({ ...record, location: e.target.value || null })} /></label>
                    <label>Capacidade<input className="luxe-input" type="number" min={1} value={record.capacity ?? ''} onChange={e => setRecord({ ...record, capacity: e.target.value ? Number(e.target.value) : null })} /></label>
                    <label>Categoria<select className="luxe-input" value={record.category} onChange={e => setRecord({ ...record, category: e.target.value })}>{Object.entries({ ASSEMBLEIA: 'Assembleia', CONFRATERNIZACAO: 'Confraternização', MANUTENCAO: 'Manutenção', REUNIAO: 'Reunião', OUTRO: 'Outro' }).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
                </>}
                {(['eventDate', 'startDate', 'endDate'] as const).filter(key => record[key] !== undefined).map(key => <label key={key}>{({ eventDate: 'Data do evento', startDate: 'Início', endDate: 'Término' })[key]}<input required className="luxe-input" type="datetime-local" value={new Date(new Date(record[key]!).getTime() - new Date(record[key]!).getTimezoneOffset() * 60000).toISOString().slice(0, 16)} onChange={e => { if (e.target.value) setRecord({ ...record, [key]: new Date(e.target.value).toISOString() }); }} /></label>)}
                {resource === 'votings' && record.options?.map((option, index) => <label key={index}>Opção {index + 1}<input required className="luxe-input" value={option.text} onChange={e => setRecord({ ...record, options: record.options!.map((o, i) => i === index ? { ...o, text: e.target.value } : o) })} /></label>)}
                {resource === 'votings' && <button type="button" className="btn-ghost" onClick={() => setRecord({ ...record, options: [...record.options ?? [], { text: '' }] })}>Adicionar opção</button>}
                <button className="btn-gold" disabled={busy}>Salvar alterações</button>
            </form>
        </LuxuryModal>}
    </div>;
}
