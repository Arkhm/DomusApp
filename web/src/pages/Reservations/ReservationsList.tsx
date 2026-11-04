import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, CalendarCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import PageBody from '../../components/luxury/PageBody';
import SectionHeader from '../../components/luxury/SectionHeader';
import Tag from '../../components/luxury/Tag';
import LuxuryModal, { LuxuryModalFooter } from '../../components/luxury/LuxuryModal';
import { EmptyTable, FilterSelect, ListMeta } from '../../components/luxury/ListHelpers';
import { formatReservationDateBR } from '../../components/luxury/formatters';
import { useAuth } from '../../hooks/useAuth';
import { apiErrorMessage } from '../../lib/apiError';
import { commonAreaService } from '../../services/commonAreaService';
import { reservationService } from '../../services/reservationService';
import type { CommonArea } from '../../types/commonArea';
import { RESERVATION_STATUS_LABELS, type Reservation, type ReservationStatus } from '../../types/reservation';

export default function ReservationsList() {
    const { user } = useAuth();
    const canDecide = user?.role === 'ADMIN' || (user?.role === 'MORADOR' && user.isSyndic);
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [areas, setAreas] = useState<CommonArea[]>([]);
    const [status, setStatus] = useState<ReservationStatus | ''>('');
    const [areaId, setAreaId] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [areaError, setAreaError] = useState('');
    const [actionError, setActionError] = useState('');
    const [revision, setRevision] = useState(0);
    const [busy, setBusy] = useState(false);
    const [rejecting, setRejecting] = useState<Reservation | null>(null);

    useEffect(() => {
        let cancelled = false;
        commonAreaService.getAll().then(data => {
            if (!cancelled) { setAreas(data); setAreaError(''); }
        }).catch(err => {
            if (!cancelled) setAreaError(apiErrorMessage(err, 'Erro ao carregar áreas para o filtro.'));
        });
        return () => { cancelled = true; };
    }, [revision]);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError('');
            try {
                const data = await reservationService.getAll({ status: status || undefined, commonAreaId: areaId || undefined });
                if (!cancelled) setReservations(data);
            } catch (err) {
                if (!cancelled) setError(apiErrorMessage(err, 'Erro ao carregar reservas.'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        void load();
        return () => { cancelled = true; };
    }, [status, areaId, revision]);

    async function approve(reservation: Reservation) {
        if (!canDecide || busy) return;
        setBusy(true);
        setActionError('');
        try {
            await reservationService.approve(reservation.id);
            toast.success('Reserva aprovada.');
            setRevision(value => value + 1);
        } catch (err) {
            setActionError(apiErrorMessage(err, 'Erro ao aprovar reserva.'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div>
            <Header title="Reservas" eyebrow="Solicitações de espaços" />
            <PageBody>
                <SectionHeader title="Reservas" eyebrow="Áreas comuns" subtitle="Acompanhe os pedidos dos moradores e as decisões da gestão." />
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                    <label>Status<FilterSelect value={status} onChange={value => setStatus(value as ReservationStatus | '')}
                        placeholder="Todos os status" options={Object.entries(RESERVATION_STATUS_LABELS).map(([value, label]) => ({ value, label }))} /></label>
                    <label>Área comum<FilterSelect value={areaId} onChange={setAreaId} placeholder="Todas as áreas"
                        options={areas.map(area => ({ value: area.id, label: area.name }))} /></label>
                    {(status || areaId) && <button className="btn-ghost" onClick={() => { setStatus(''); setAreaId(''); }}>Limpar filtros</button>}
                </div>
                {areaError && <p role="alert" style={{ color: 'var(--color-err)', marginBottom: 16 }}>{areaError}</p>}
                {actionError && <p role="alert" style={{ color: 'var(--color-err)', marginBottom: 16 }}>{actionError}</p>}
                <ListMeta count={reservations.length} singular="reserva" plural="reservas" />
                {error ? <div role="alert" className="luxe-card" style={{ padding: 24, color: 'var(--color-err)' }}>
                    <p>{error}</p><button className="btn-ghost" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button>
                </div> : loading ? <p role="status"><Loader2 size={18} className="animate-spin" /> Carregando reservas...</p>
                    : reservations.length === 0 ? <div className="luxe-card"><EmptyTable title="Nenhuma reserva encontrada" hint="Confira os filtros selecionados." /></div>
                    : <div className="luxe-card" style={{ overflowX: 'auto' }}>
                        <table className="luxe-table">
                            <thead><tr><th>Área</th><th>Morador / unidade</th><th>Data</th><th>Horário (Brasília)</th><th>Status</th>{canDecide && <th>Ações</th>}</tr></thead>
                            <tbody>{reservations.map(reservation => <tr key={reservation.id}>
                                <td>{reservation.commonArea.name}</td>
                                <td>{reservation.user.name}<p style={{ color: 'var(--color-bone-dim)' }}>
                                    {reservation.user.unit ? [reservation.user.unit.block, reservation.user.unit.number].filter(Boolean).join(' / ') : 'Sem unidade'}
                                </p></td>
                                <td style={{ whiteSpace: 'nowrap' }}>{formatReservationDateBR(reservation.date)}</td>
                                <td style={{ whiteSpace: 'nowrap' }}>{reservation.startTime} às {reservation.endTime}</td>
                                <td><Tag tone={reservation.status === 'APPROVED' ? 'ok' : reservation.status === 'PENDING' ? 'warn' : 'neutral'}>
                                    {RESERVATION_STATUS_LABELS[reservation.status]}</Tag>
                                    {reservation.rejectionReason && <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginTop: 8 }}>{reservation.rejectionReason}</p>}
                                </td>
                                {canDecide && <td>{reservation.status === 'PENDING' && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <button className="btn-gold" disabled={busy} onClick={() => void approve(reservation)}>Aprovar</button>
                                    <button className="btn-ghost" disabled={busy} onClick={() => setRejecting(reservation)}>Rejeitar</button>
                                </div>}</td>}
                            </tr>)}</tbody>
                        </table>
                    </div>}
            </PageBody>
            {canDecide && rejecting && <RejectionModal reservation={rejecting} onClose={() => setRejecting(null)}
                onSuccess={() => { setRejecting(null); setActionError(''); setRevision(value => value + 1); }} />}
        </div>
    );
}

function RejectionModal({ reservation, onClose, onSuccess }: { reservation: Reservation; onClose: () => void; onSuccess: () => void }) {
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            await reservationService.reject(reservation.id, reason.trim() || undefined);
            toast.success('Reserva rejeitada.');
            onSuccess();
        } catch (err) {
            setError(apiErrorMessage(err, 'Erro ao rejeitar reserva.'));
        } finally {
            setBusy(false);
        }
    }

    return <LuxuryModal open onClose={onClose} busy={busy} icon={<CalendarCheck size={18} />} title="Rejeitar reserva">
        <form onSubmit={submit} style={{ padding: 28, display: 'grid', gap: 18 }}>
            <p>{reservation.commonArea.name} · {formatReservationDateBR(reservation.date)} · {reservation.startTime} às {reservation.endTime}</p>
            {error && <p role="alert" style={{ color: 'var(--color-err)' }}>{error}</p>}
            <label>Motivo (opcional)
                <textarea autoFocus className="luxe-input" maxLength={500} rows={4} value={reason} disabled={busy}
                    onChange={event => setReason(event.target.value)} />
            </label>
            <LuxuryModalFooter onCancel={onClose} submitLabel="Rejeitar reserva" loadingLabel="Rejeitando..." isSubmitting={busy} />
        </form>
    </LuxuryModal>;
}
