import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/tokens';

// Cria e remove somente fixtures próprias; nunca redefine o banco existente.
async function main() {
  assert.notEqual(process.env.NODE_ENV, 'production', 'Execute apenas em desenvolvimento.');
  const userIds = [randomUUID(), randomUUID()];
  const unitIds = [randomUUID(), randomUUID()];
  const base = `http://localhost:${process.env.PORT || 3333}`;
  const token = (index: number) => signAccessToken({ id: userIds[index], role: 'MORADOR', isSyndic: index === 0 });
  const call = (path: string, index = 0, method = 'GET') => fetch(base + path, {
    method, headers: index < 0 ? {} : { Authorization: `Bearer ${token(index)}` },
  });
  try {
    for (let i = 0; i < 2; i++) {
      await prisma.unit.create({ data: { id: unitIds[i], number: `test-${i}` } });
      await prisma.user.create({ data: {
        id: userIds[i], name: 'Teste de notificações', email: `${userIds[i]}@example.invalid`,
        cpf: userIds[i], password: randomUUID(), role: 'MORADOR', unitId: unitIds[i], isSyndic: i === 0,
      } });
    }
    const notice = (data: { status?: string; targetType?: string; targetUnitId?: string }) =>
      prisma.notice.create({ data: { title: 'Notificação de teste', content: 'Acentuação: manutenção até amanhã.', authorId: userIds[0], ...data } });
    const shared = await notice({});
    const own = await notice({ targetType: 'UNIT', targetUnitId: unitIds[0] });
    const other = await notice({ targetType: 'UNIT', targetUnitId: unitIds[1] });
    const draft = await notice({ status: 'DRAFT' });
    const event = await prisma.event.create({ data: { title: 'Evento de teste', content: 'Detalhes', eventDate: new Date(), authorId: userIds[0], status: 'CANCELLED' } });
    const privateEvent = await prisma.event.create({ data: { title: 'Outro apartamento', content: 'Privado', eventDate: new Date(), authorId: userIds[0], targetType: 'UNIT', targetUnitId: unitIds[1] } });
    const draftEvent = await prisma.event.create({ data: { title: 'Rascunho', content: 'Privado', eventDate: new Date(), authorId: userIds[0], status: 'DRAFT' } });
    assert.equal((await call('/notifications', -1)).status, 401);
    let response = await call('/notifications');
    assert.equal(response.status, 200);
    type Item = { id: string; sourceId: string; isRead: boolean; createdAt: string; description: string };
    let items: Item[] = await response.json();
    for (const id of [shared.id, own.id, event.id]) assert(items.some((item) => item.sourceId === id && !item.isRead));
    for (const id of [other.id, draft.id, privateEvent.id, draftEvent.id]) assert(!items.some((item) => item.sourceId === id));
    assert.equal(items.find((item) => item.sourceId === event.id)?.description, 'Evento cancelado');
    for (let i = 1; i < items.length; i++) assert(Date.parse(items[i - 1].createdAt) >= Date.parse(items[i].createdAt));
    assert.equal((await call(`/notifications/NOTICE/${other.id}/read`, 0, 'POST')).status, 404);
    assert.equal((await call(`/notifications/NOTICE/${draft.id}/read`, 0, 'POST')).status, 404);
    assert.equal((await call(`/notifications/INVALID/${shared.id}/read`, 0, 'POST')).status, 400);
    assert.equal((await call('/notifications/NOTICE/not-a-uuid/read', 0, 'POST')).status, 400);
    for (let i = 0; i < 2; i++) assert.equal((await call(`/notifications/NOTICE/${shared.id}/read`, 0, 'POST')).status, 200);
    assert.equal(await prisma.notificationRead.count({ where: { userId: userIds[0], sourceId: shared.id } }), 1);
    assert.equal(await prisma.noticeRead.count({ where: { userId: userIds[0], noticeId: shared.id } }), 0);
    items = await (await call('/notifications')).json();
    assert.equal(items.find((item) => item.sourceId === shared.id)?.isRead, true);
    const secondUser: Item[] = await (await call('/notifications', 1)).json();
    assert.equal(secondUser.find((item) => item.sourceId === shared.id)?.isRead, false);
    assert(!secondUser.some((item) => item.sourceId === own.id));
    await prisma.notice.delete({ where: { id: shared.id } });
    items = await (await call('/notifications')).json();
    assert(!items.some((item) => item.sourceId === shared.id));
    await prisma.user.update({ where: { id: userIds[0] }, data: { status: 'INACTIVE' } });
    assert.equal((await call('/notifications')).status, 401);
    console.log('PASS: destinatários, rascunhos, síndico, ordenação, validação, leitura persistida e idempotente, isolamento por usuário, conteúdo removido e conta inativa.');
  } finally {
    await prisma.notice.deleteMany({ where: { authorId: { in: userIds } } });
    await prisma.event.deleteMany({ where: { authorId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.unit.deleteMany({ where: { id: { in: unitIds } } });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
