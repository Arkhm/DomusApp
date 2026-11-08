import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import app from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createAuthTokens } from '../src/lib/authTokens';
import { userRepository } from '../src/repositories/userRepository';
import { reportRepository } from '../src/repositories/reportRepository';
import { reportService } from '../src/services/reportService';
import { reportPeriodSchema, resolveReportPeriod, saoPauloDayStart } from '../src/schemas/reportSchema';

const admin = { id: randomUUID(), role: 'ADMIN', isSyndic: false, tokenVersion: 0 };
const resident = { ...admin, id: randomUUID(), role: 'MORADOR' };
const period = { startDate: '2035-01-01', endDate: '2035-12-31' };
const routes = ['occupancy', 'charges-summary', 'incidents', 'reservations'];
const bearer = (actor: typeof admin) => 'Bearer ' + createAuthTokens(actor).token;

test('relatórios: Swagger tem as quatro operações e referências resolvidas', () => {
  const document = parse(readFileSync('docs/openapi.yaml', 'utf8'));
  function check(value: any) {
    if (!value || typeof value !== 'object') return;
    if (value.$ref) {
      assert.ok(value.$ref.split('/').slice(1).reduce((node: any, key: string) => node?.[key], document), value.$ref);
    }
    for (const child of Object.values(value)) check(child);
  }
  for (const route of routes) {
    const operation = document.paths['/reports/' + route]?.get;
    assert.ok(operation?.responses?.['200']?.content?.['application/json']?.schema);
    if (route !== 'occupancy') assert.equal(operation.parameters.length, 2);
    check(operation);
  }
  for (const [name, schema] of Object.entries(document.components.schemas)) if (name.startsWith('Report')) check(schema);
});

test('relatórios: período civil, padrão de 12 meses e limite de 24 meses', () => {
  assert.deepEqual(resolveReportPeriod({}, new Date('2026-11-01T02:59:59Z')), { startDate: '2025-11-01', endDate: '2026-10-31' });
  assert.deepEqual(reportPeriodSchema.parse({ endDate: '2035-03-31', ignored: true }), { startDate: '2034-04-01', endDate: '2035-03-31' });
  for (const input of [
    { startDate: '2035-02-30' }, { startDate: '2035-1-01' }, { startDate: ['2035-01-01'] },
    { endDate: { gte: '2035-01-01' } }, { startDate: '2035-02-01', endDate: '2035-01-31' },
    { startDate: '2035-01-01', endDate: '2037-01-01' }, { startDate: '2035-01-01T00:00:00Z' },
    { startDate: '0000-01-01' }, { endDate: '9999-01-01' },
  ]) assert.equal(reportPeriodSchema.safeParse(input).success, false, JSON.stringify(input));
  assert.equal(reportPeriodSchema.safeParse({ startDate: '2035-01-01', endDate: '2036-12-31' }).success, true);
  assert.equal(reportPeriodSchema.safeParse({ startDate: '2024-02-29', endDate: '2026-02-27' }).success, true);
  assert.equal(reportPeriodSchema.safeParse({ startDate: '2024-02-29', endDate: '2026-02-28' }).success, false);
  assert.equal(saoPauloDayStart('2035-02-01').toISOString(), '2035-02-01T03:00:00.000Z');
  assert.equal(saoPauloDayStart('2018-01-01').toISOString(), '2018-01-01T02:00:00.000Z');
  assert.equal(saoPauloDayStart('2018-11-04').toISOString(), '2018-11-04T03:00:00.000Z');
  assert.equal(saoPauloDayStart('2019-02-17').toISOString(), '2019-02-17T03:00:00.000Z');
  assert.equal(saoPauloDayStart('1900-01-01').toISOString(), '1900-01-01T03:06:28.000Z');
  assert.equal(reportPeriodSchema.safeParse({ startDate: '9998-01-01', endDate: '9998-01-02' }).success, true);
  assert.deepEqual(reportPeriodSchema.parse({ endDate: '1000-01-02' }), { startDate: '1000-01-01', endDate: '1000-01-02' });
});

test('relatórios: ocupação soma unidades, sem multiplicar moradores e sem média de percentuais', async t => {
  t.mock.method(reportRepository, 'occupancy', async () => [
    { block: 'A', total: 3n, occupied: 1n }, { block: 'Sem bloco', total: 1n, occupied: 1n },
  ]);
  const result = await reportService.occupancy(admin);
  assert.deepEqual(result.byBlock[0], { block: 'A', total: 3, occupied: 1, occupancyRate: 33.3 });
  assert.deepEqual(result.total, { total: 4, occupied: 2, occupancyRate: 50 });
});

test('relatórios: somas decimais exatas, taxa por valor e total maior que teto individual', async t => {
  t.mock.method(reportRepository, 'charges', async () => [
    { month: '2035-01', status: 'PAID', count: 2n, amount: new Prisma.Decimal('0.30') },
    { month: '2035-01', status: 'OVERDUE', count: 1n, amount: new Prisma.Decimal('0.10') },
    { month: '2035-02', status: 'PENDING', count: 3n, amount: new Prisma.Decimal('199999999.98') },
    { month: '2035-02', status: 'OVERDUE', count: 1n, amount: new Prisma.Decimal('0.20') },
  ]);
  const result = await reportService.chargesSummary(admin, period);
  assert.equal(result.byMonth[0]!.total.amount, '0.40');
  assert.equal(result.byMonth[0]!.delinquencyRate, 25);
  assert.equal(result.summary.overdue.amount, '0.30');
  assert.equal(result.summary.total.amount, '200000000.58');
  assert.equal(result.summary.total.count, 7);
  assert.equal(result.summary.delinquencyRate, 0);
  assert.doesNotThrow(() => JSON.stringify(result));
});

test('relatórios: agrupa áreas por ID mesmo com nomes iguais e soma status', async t => {
  t.mock.method(reportRepository, 'incidents', async () => ({
    byCategory: [{ category: 'BARULHO', count: 3 }], byStatus: [{ status: 'OPEN', count: 1 }, { status: 'CLOSED', count: 2 }],
  }));
  assert.equal((await reportService.incidents(admin, period)).total, 3);
  t.mock.method(reportRepository, 'reservations', async () => [
    { areaId: 'a', areaName: 'Salão', status: 'APPROVED', count: 2n },
    { areaId: 'a', areaName: 'Salão', status: 'CANCELLED', count: 1n },
    { areaId: 'b', areaName: 'Salão', status: 'APPROVED', count: 3n },
  ]);
  const result = await reportService.reservations(admin, period);
  assert.equal(result.total, 6);
  assert.equal(result.byArea.length, 2);
  assert.equal(result.byArea[0]!.count, 3);
  assert.deepEqual(result.byStatus, [{ status: 'APPROVED', count: 5 }, { status: 'CANCELLED', count: 1 }]);
});

test('relatórios: sem dados retorna listas vazias, zeros e nunca NaN', async t => {
  t.mock.method(reportRepository, 'occupancy', async () => []);
  t.mock.method(reportRepository, 'charges', async () => []);
  t.mock.method(reportRepository, 'incidents', async () => ({ byCategory: [], byStatus: [] }));
  t.mock.method(reportRepository, 'reservations', async () => []);
  assert.deepEqual((await reportService.occupancy(admin)).total, { total: 0, occupied: 0, occupancyRate: 0 });
  const charges = await reportService.chargesSummary(admin, period);
  assert.equal(charges.summary.total.amount, '0.00');
  assert.equal(charges.summary.delinquencyRate, 0);
  assert.deepEqual(charges.byMonth, []);
  assert.equal((await reportService.incidents(admin, period)).total, 0);
  assert.deepEqual((await reportService.reservations(admin, period)).byStatus, []);
});

test('relatórios: serviço nega acesso antes de consultar e valida períodos', async t => {
  const find = t.mock.method(reportRepository, 'occupancy', async () => []);
  for (const actor of [resident, { ...resident, role: 'VISITANTE', isSyndic: true }]) {
    for (const method of ['occupancy', 'chargesSummary', 'incidents', 'reservations'] as const) {
      await assert.rejects(() => reportService[method](actor, period), (error: any) => error.statusCode === 403);
    }
  }
  assert.equal(find.mock.callCount(), 0);
  await assert.rejects(() => reportService.incidents(admin, { startDate: 'inválida' }), (error: any) => error.statusCode === 400);
});

test('relatórios: HTTP exige sessão atual e papel, valida filtros e oculta erros internos', async t => {
  const actors = [admin, { ...admin, id: randomUUID(), role: 'FUNCIONARIO' },
    { ...resident, id: randomUUID(), isSyndic: true }, resident, { ...resident, id: randomUUID(), role: 'VISITANTE', isSyndic: true }];
  t.mock.method(userRepository, 'findAuthState', async (id: string) => {
    const actor = actors.find(value => value.id === id)!;
    return { ...actor, status: 'ACTIVE' };
  });
  const occupancy = t.mock.method(reportRepository, 'occupancy', async () => []);
  t.mock.method(reportRepository, 'charges', async () => []);
  t.mock.method(reportRepository, 'incidents', async () => ({ byCategory: [], byStatus: [] }));
  t.mock.method(reportRepository, 'reservations', async () => []);
  for (const route of routes) {
    await request(app).get('/reports/' + route).expect(401);
    for (const actor of actors) {
      await request(app).get('/reports/' + route).query(period).set('Authorization', bearer({ ...actor, role: 'ADMIN' }))
        .expect(actor.id === resident.id || actor.role === 'VISITANTE' ? 403 : 200);
    }
    if (route !== 'occupancy') {
      for (const query of ['startDate=2035-02-30', 'startDate=2035-02-01&endDate=2035-01-01',
        'startDate=2035-01-01&startDate=2035-01-02', 'startDate=2035-01-01&endDate=2037-01-01']) {
        await request(app).get('/reports/' + route + '?' + query).set('Authorization', bearer(admin)).expect(400);
      }
    }
  }
  occupancy.mock.mockImplementation(async () => { throw new Error('segredo-interno-do-banco'); });
  const response = await request(app).get('/reports/occupancy').set('Authorization', bearer(admin)).expect(500);
  assert.equal(response.body.error, 'Não foi possível carregar o relatório.');
});

test('relatórios: cobranças usam limites civis UTC sem deslocar vencimentos para o mês anterior', async t => {
  const queries: Prisma.Sql[] = [];
  const original = prisma.$queryRaw;
  t.after(() => { prisma.$queryRaw = original; });
  prisma.$queryRaw = (async (...args: any[]) => {
    const query = Array.isArray(args[0]) ? Prisma.sql(args[0], ...args.slice(1)) : args[0];
    queries.push(query);
    return [];
  }) as typeof prisma.$queryRaw;
  await reportRepository.occupancy();
  const now = new Date('2035-03-15T12:00Z');
  await reportRepository.charges({ startDate: '2035-01-31', endDate: '2035-02-01' }, now);
  await reportRepository.reservations({ startDate: '2035-01-31', endDate: '2035-02-01' });
  assert.match(queries[0]!.sql, /EXISTS/);
  assert.match(queries[0]!.sql, /r.role = 'MORADOR' AND r.status = 'ACTIVE'/);
  assert.match(queries[1]!.sql, /SUM\(classified.amount\)/);
  assert.match(queries[1]!.sql, /i.dueDate < \?/);
  assert.deepEqual(queries[1]!.values.filter((value): value is Date => value instanceof Date)
    .map(value => value.toISOString()).sort(), [
    '2035-01-31T00:00:00.000Z', '2035-02-01T00:00:00.000Z',
    '2035-02-01T00:00:00.000Z', '2035-02-02T00:00:00.000Z', now.toISOString(),
  ].sort());
  assert.ok(queries[2]!.values.some((value: unknown) => value instanceof Date && value.toISOString() === '2035-01-31T00:00:00.000Z'));
});
