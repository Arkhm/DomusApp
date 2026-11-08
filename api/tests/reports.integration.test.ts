import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { IncidentCategory, IncidentStatus, ReservationStatus } from '@prisma/client';
import app from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createAuthTokens } from '../src/lib/authTokens';
import { reportRepository } from '../src/repositories/reportRepository';
import { validDate } from '../src/lib/paymentDomain';

test('relatórios: agregações e HTTP com fixtures MySQL isoladas', { skip: process.env.RUN_DB_INTEGRATION !== 'true' }, async t => {
  assert.match(process.env.DATABASE_NAME ?? '', /_test$/, 'Integração exige banco terminado em _test.');
  const suffix = randomUUID();
  const unitIds = Array.from({ length: 6 }, () => randomUUID());
  const userIds = Array.from({ length: 7 }, () => randomUUID());
  const areaIds = [randomUUID(), randomUUID()];
  const block = 'relatorios-' + suffix;
  const period = { startDate: '2073-01-31', endDate: '2073-03-01' };
  const query = '?startDate=' + period.startDate + '&endDate=' + period.endDate;
  t.after(async () => {
    try {
      await prisma.invoice.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.incident.deleteMany({ where: { authorId: { in: userIds } } });
      await prisma.reservation.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.commonArea.deleteMany({ where: { id: { in: areaIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.unit.deleteMany({ where: { id: { in: unitIds } } });
    } finally { await prisma.$disconnect(); }
  });
  await prisma.unit.createMany({ data: unitIds.map((id, index) => ({
    id, number: String(index), block: index < 4 ? block : index === 4 ? null : '',
  })) });
  await prisma.user.createMany({ data: userIds.map((id, index) => ({
    id, name: 'Pessoa de teste ' + index, email: index + '-relatorios-' + suffix + '@example.com',
    cpf: index + '-' + suffix, password: 'hash-ficticio', tokenVersion: 0,
    role: index === 0 ? 'ADMIN' : index === 1 ? 'FUNCIONARIO' : 'MORADOR',
    isSyndic: index === 2, status: index === 6 ? 'INACTIVE' : 'ACTIVE',
    // Dois moradores na mesma unidade contam uma vez; admin/funcionário e inativo não ocupam.
    unitId: index <= 1 ? unitIds[0]! : index <= 3 ? unitIds[1]! : index === 4 ? unitIds[4]! : index === 5 ? unitIds[5]! : unitIds[2]!,
  })) });
  const token = (index: number) => 'Bearer ' + createAuthTokens({
    id: userIds[index]!, role: index === 0 ? 'ADMIN' : index === 1 ? 'FUNCIONARIO' : 'MORADOR',
    isSyndic: index === 2, tokenVersion: 0,
  }).token;
  await prisma.commonArea.createMany({ data: areaIds.map(id => ({ id, name: 'Salão ' + suffix })) });
  const invoices = [
    ['2073-01-30T23:59:59.999Z', '999.00', 'PAID'],
    ['2073-01-31', '0.10', 'PAID'],
    ['2073-01-31T23:59:59.999Z', '0.20', 'PAID'],
    ['2073-01-31T12:00:00.000Z', '0.10', 'PENDING'],
    ['2073-02-01', '100.00', 'PENDING'],
    ['2073-02-02T03:00:00.000Z', '50.00', 'OVERDUE'],
    ['2073-03-01T23:59:59.999Z', '0.05', 'PAID'],
    ['2073-03-02', '999.00', 'PAID'],
    ...['CANCELLED', 'EXPIRED', 'REJECTED', 'REFUNDED', 'CHARGED_BACK', 'PARTIALLY_REFUNDED'].map(status => ['2073-02-02T03:00:00.000Z', '999.00', status]),
  ] as const;
  await prisma.invoice.createMany({ data: invoices.map(([dueDate, amount, status]) => ({
    description: 'Fatura de relatório ' + suffix, dueDate: validDate(dueDate, 'Data de vencimento'), amount, status,
    userId: userIds[3]!, unitId: unitIds[1]!,
  })) });
  await prisma.incident.createMany({ data: [
    { category: 'BARULHO', status: 'OPEN', createdAt: new Date('2073-01-31T03:00:00Z') },
    { category: 'BARULHO', status: 'RESOLVED', createdAt: new Date('2073-03-02T02:59:59.999Z') },
    { category: 'LIMPEZA', status: 'CLOSED', createdAt: new Date('2073-02-10T12:00:00Z') },
    { category: 'SEGURANCA', status: 'OPEN', createdAt: new Date('2073-01-31T02:59:59.999Z') },
    { category: 'SEGURANCA', status: 'OPEN', createdAt: new Date('2073-03-02T03:00:00Z') },
  ].map(row => ({ ...row, category: row.category as IncidentCategory, status: row.status as IncidentStatus,
    title: 'Ocorrência teste', description: 'Descrição teste', authorId: userIds[3]!, unitId: unitIds[1]! })) });
  await prisma.reservation.createMany({ data: [
    { date: new Date('2073-01-31T00:00:00Z'), commonAreaId: areaIds[0]!, status: 'APPROVED' },
    { date: new Date('2073-02-10T00:00:00Z'), commonAreaId: areaIds[0]!, status: 'PENDING' },
    { date: new Date('2073-03-01T00:00:00Z'), commonAreaId: areaIds[1]!, status: 'CANCELLED' },
    { date: new Date('2073-02-11T00:00:00Z'), commonAreaId: areaIds[1]!, status: 'REJECTED' },
    { date: new Date('2073-01-30T00:00:00Z'), commonAreaId: areaIds[0]!, status: 'APPROVED' },
    { date: new Date('2073-03-02T00:00:00Z'), commonAreaId: areaIds[0]!, status: 'APPROVED' },
  ].map(row => ({ ...row, status: row.status as ReservationStatus, userId: userIds[3]!, startTime: '10:00', endTime: '11:00' })) });

  await t.test('401/403 reais e gestão autorizada nas quatro rotas', async () => {
    for (const route of ['occupancy', 'charges-summary', 'incidents', 'reservations']) {
      await request(app).get('/reports/' + route + query).expect(401);
      await request(app).get('/reports/' + route + query).set('Authorization', token(3)).expect(403);
      for (const index of [0, 1, 2]) await request(app).get('/reports/' + route + query).set('Authorization', token(index)).expect(200);
    }
    await request(app).get('/reports/incidents?startDate=2073-02-30').set('Authorization', token(0)).expect(400);
  });
  await t.test('ocupação por unidade, bloco vazio/nulo e total geral consistente', async () => {
    const { body } = await request(app).get('/reports/occupancy').set('Authorization', token(0)).expect(200);
    assert.deepEqual(body.byBlock.find((row: any) => row.block === block), { block, total: 4, occupied: 1, occupancyRate: 25 });
    const unblocked = body.byBlock.find((row: any) => row.block === 'Sem bloco');
    assert.ok(unblocked.total >= 2 && unblocked.occupied >= 2);
    assert.equal(body.total.total, body.byBlock.reduce((sum: number, row: any) => sum + row.total, 0));
    assert.equal(body.total.occupied, body.byBlock.reduce((sum: number, row: any) => sum + row.occupied, 0));
  });
  await t.test('faturas: datas civis UTC, centavos exatos, passado estrito e estados excluídos', async () => {
    const rows = await reportRepository.charges(period, new Date('2073-02-01T00:00:00Z'));
    const values = rows.map(row => ({ ...row, count: Number(row.count), amount: row.amount.toFixed(2) }));
    assert.deepEqual(values, [
      { month: '2073-01', status: 'OVERDUE', count: 1, amount: '0.10' },
      { month: '2073-01', status: 'PAID', count: 2, amount: '0.30' },
      { month: '2073-02', status: 'OVERDUE', count: 1, amount: '50.00' },
      { month: '2073-02', status: 'PENDING', count: 1, amount: '100.00' },
      { month: '2073-03', status: 'PAID', count: 1, amount: '0.05' },
    ]);
    const { body } = await request(app).get('/reports/charges-summary' + query).set('Authorization', token(0)).expect(200);
    assert.equal(body.summary.total.amount, '150.45');
    assert.equal(body.summary.total.count, 6);
    assert.equal(body.summary.paid.amount, '0.35');
    assert.equal(body.byMonth.length, 3);
    assert.equal(body.summary.delinquencyRate, 33.2);
    const later = await reportRepository.charges(period, new Date('2073-02-01T00:00:00.001Z'));
    assert.equal(later.find(row => row.month === '2073-02' && row.status === 'OVERDUE')!.amount.toFixed(2), '150.00');
    const firstDay = await reportRepository.charges({ startDate: '2073-02-01', endDate: '2073-02-01' }, new Date('2073-02-01T00:00:00Z'));
    assert.deepEqual(firstDay.map(row => ({ month: row.month, count: Number(row.count), amount: row.amount.toFixed(2) })),
      [{ month: '2073-02', count: 1, amount: '100.00' }]);
  });
  await t.test('ocorrências usam createdAt local, categorias e status atuais', async () => {
    const { body } = await request(app).get('/reports/incidents' + query).set('Authorization', token(1)).expect(200);
    assert.equal(body.total, 3);
    assert.deepEqual(Object.fromEntries(body.byCategory.map((row: any) => [row.category, row.count])), { BARULHO: 2, LIMPEZA: 1 });
    assert.deepEqual(Object.fromEntries(body.byStatus.map((row: any) => [row.status, row.count])), { OPEN: 1, RESOLVED: 1, CLOSED: 1 });
  });
  await t.test('reservas usam dia civil UTC inclusivo e separam áreas homônimas', async () => {
    const { body } = await request(app).get('/reports/reservations' + query).set('Authorization', token(2)).expect(200);
    assert.equal(body.total, 4);
    assert.equal(body.byArea.length, 2);
    assert.ok(body.byArea.every((row: any) => row.count === 2));
    assert.deepEqual(Object.fromEntries(body.byStatus.map((row: any) => [row.status, row.count])), { APPROVED: 1, PENDING: 1, CANCELLED: 1, REJECTED: 1 });
    const { body: empty } = await request(app).get('/reports/incidents?startDate=2074-01-01&endDate=2074-01-01').set('Authorization', token(0)).expect(200);
    assert.deepEqual(empty.byCategory, []);
  });
});
