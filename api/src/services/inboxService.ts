import { inboxRepository } from '../repositories/inboxRepository';
import { hasPanelAccess } from '../lib/access';
import { dueDayCutoff } from '../lib/invoiceDate';
import { HttpError } from '../lib/httpError';
type Actor = { id: string; role: string; isSyndic?: boolean };
export const inboxService = {
  async capture(actor: Actor) {
    const panel = hasPanelAccess(actor);
    const financial = actor.role === 'ADMIN' || actor.role === 'FUNCIONARIO' || (actor.role === 'MORADOR' && actor.isSyndic);
    // A transaction gives the materialized inbox a consistent local snapshot.
    await inboxRepository.snapshot(async tx => {
      const since = new Date(Date.now() - 180 * 86400000);
      const [invoices, reservations, votings, incidents] = await inboxRepository.sources(tx, actor.id, panel, !!financial, since);
      const entries: { type: string; sourceId: string; title: string; description: string; revision: string }[] = [];
      for (const i of invoices) {
        if (i.userId === actor.id) {
          entries.push({ type: 'INVOICE', sourceId: i.id, title: i.description, description: 'Cobrança disponível', revision: 'created' });
          if (i.status === 'PAID') entries.push({ type: 'INVOICE', sourceId: i.id, title: i.description, description: 'Pagamento confirmado', revision: 'paid' });
          if (['PENDING', 'OVERDUE'].includes(i.status) && i.dueDate < dueDayCutoff()) entries.push({ type: 'INVOICE', sourceId: i.id, title: i.description, description: 'Cobrança vencida', revision: 'overdue' });
        }
        if (financial && i.requiresReview) entries.push({ type: 'INVOICE', sourceId: i.id, title: i.description, description: 'Cobrança exige revisão', revision: `review:${i.audits[0]?.id ?? 'initial'}` });
      }
      for (const r of reservations) {
        if (r.userId === actor.id && ['APPROVED', 'REJECTED'].includes(r.status)) entries.push({ type: 'RESERVATION', sourceId: r.id, title: r.commonArea.name, description: r.status === 'APPROVED' ? 'Reserva aprovada' : 'Reserva rejeitada', revision: r.status });
        if (panel && r.status === 'PENDING') entries.push({ type: 'RESERVATION', sourceId: r.id, title: r.commonArea.name, description: 'Nova reserva aguardando avaliação', revision: 'pending' });
      }
      for (const v of votings) entries.push({ type: 'VOTING', sourceId: v.id, title: v.title, description: 'Votação publicada', revision: 'published' });
      for (const i of incidents) entries.push({ type: 'INCIDENT', sourceId: i.id, title: i.title, description: 'Nova ocorrência para atendimento', revision: 'open' });
      const sourceDates = new Map<string, Date>();
      for (const i of invoices) sourceDates.set(i.id, i.createdAt);
      for (const r of reservations) sourceDates.set(r.id, r.updatedAt);
      for (const v of votings) sourceDates.set(v.id, v.createdAt);
      for (const i of incidents) sourceDates.set(i.id, i.createdAt);
      const data = entries.map(({ revision, ...e }) => ({ ...e, userId: actor.id, key: `${actor.id}:${e.type}:${e.sourceId}:${revision}`,
        createdAt: e.type === 'INVOICE' && e.description === 'Pagamento confirmado' ? invoices.find(i => i.id === e.sourceId)?.paidAt ?? sourceDates.get(e.sourceId) ?? new Date() : e.type === 'INVOICE' && e.description === 'Cobrança exige revisão' ? invoices.find(i => i.id === e.sourceId)!.audits[0]?.createdAt ?? invoices.find(i => i.id === e.sourceId)!.updatedAt : sourceDates.get(e.sourceId) ?? new Date() })).filter(e => e.createdAt >= since);
      await inboxRepository.insertMissing(tx, data);

    });
  },
  async list(actor: Actor) {
    const items = await inboxRepository.list(actor.id);
    return items.map(({ id, type, sourceId, title, description, createdAt, readAt }) => ({ id: `INBOX:${id}`, eventId: id, type, sourceId, title, description, createdAt, isRead: readAt !== null }));
  },
  async read(actor: Actor, id: string) {
    const item = await inboxRepository.findOwned(id, actor.id);
    if (!item) throw new HttpError(404, 'Notificação não encontrada.');
    await inboxRepository.read(item.id);
  },
  async captureAll() {
    const users = await inboxRepository.users();
    for (const user of users) await this.capture(user);
    await inboxRepository.prune();
  },
};
