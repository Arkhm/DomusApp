import { prisma } from '../lib/prisma';
import { hasPanelAccess } from '../lib/access';
import { dueDayCutoff } from '../lib/invoiceDate';
import { HttpError } from '../lib/httpError';
type Actor = { id: string; role: string; isSyndic?: boolean };
export const inboxService = {
  async capture(actor: Actor) {
    const panel = hasPanelAccess(actor);
    const financial = actor.role === 'ADMIN' || actor.role === 'FUNCIONARIO' || (actor.role === 'MORADOR' && actor.isSyndic);
    // A transaction gives the materialized inbox a consistent local snapshot.
    await prisma.$transaction(async tx => {
      const [invoices, reservations, votings, incidents] = await Promise.all([
        tx.invoice.findMany({ where: financial ? { OR: [{ userId: actor.id }, { requiresReview: true }] } : { userId: actor.id } }),
        tx.reservation.findMany({ where: panel ? { OR: [{ userId: actor.id }, { status: 'PENDING' }] } : { userId: actor.id }, include: { commonArea: true } }),
        tx.voting.findMany(),
        panel ? tx.incident.findMany({ where: { status: 'OPEN' } }) : Promise.resolve([]),
      ]);
      const entries: { type: string; sourceId: string; title: string; description: string; revision: string }[] = [];
      for (const i of invoices) {
        if (i.userId === actor.id) {
          entries.push({ type: 'INVOICE', sourceId: i.id, title: i.description, description: 'Cobrança disponível', revision: 'created' });
          if (i.status === 'PAID') entries.push({ type: 'INVOICE', sourceId: i.id, title: i.description, description: 'Pagamento confirmado', revision: 'paid' });
          if (['PENDING', 'OVERDUE'].includes(i.status) && i.dueDate < dueDayCutoff()) entries.push({ type: 'INVOICE', sourceId: i.id, title: i.description, description: 'Cobrança vencida', revision: 'overdue' });
        }
        if (financial && i.requiresReview) entries.push({ type: 'INVOICE', sourceId: i.id, title: i.description, description: 'Cobrança exige revisão', revision: `review:${i.version}` });
      }
      for (const r of reservations) {
        if (r.userId === actor.id && ['APPROVED', 'REJECTED'].includes(r.status)) entries.push({ type: 'RESERVATION', sourceId: r.id, title: r.commonArea.name, description: r.status === 'APPROVED' ? 'Reserva aprovada' : 'Reserva rejeitada', revision: r.status });
        if (panel && r.status === 'PENDING') entries.push({ type: 'RESERVATION', sourceId: r.id, title: r.commonArea.name, description: 'Nova reserva aguardando avaliação', revision: 'pending' });
      }
      for (const v of votings) entries.push({ type: 'VOTING', sourceId: v.id, title: v.title, description: 'Votação publicada', revision: 'published' });
      for (const i of incidents) entries.push({ type: 'INCIDENT', sourceId: i.id, title: i.title, description: 'Nova ocorrência para atendimento', revision: 'open' });
      for (const e of entries) {
        const { revision, ...data } = e;
        await tx.inboxNotification.upsert({ where: { key: `${actor.id}:${e.type}:${e.sourceId}:${revision}` },
          create: { ...data, userId: actor.id, key: `${actor.id}:${e.type}:${e.sourceId}:${revision}` }, update: {} });
      }
    });
  },
  async list(actor: Actor) {
    await this.capture(actor);
    const items = await prisma.inboxNotification.findMany({ where: { userId: actor.id }, orderBy: { createdAt: 'desc' } });
    return items.map(({ id, type, sourceId, title, description, createdAt, readAt }) => ({ id: `INBOX:${id}`, eventId: id, type, sourceId, title, description, createdAt, isRead: readAt !== null }));
  },
  async read(actor: Actor, id: string) {
    const item = await prisma.inboxNotification.findFirst({ where: { id, userId: actor.id } });
    if (!item) throw new HttpError(404, 'Notificação não encontrada.');
    await prisma.inboxNotification.update({ where: { id: item.id }, data: { readAt: new Date() } });
  },
  async captureAll() {
    const users = await prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true, role: true, isSyndic: true } });
    for (const user of users) await this.capture(user);
  },
};
