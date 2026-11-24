import test from 'node:test';
import assert from 'node:assert/strict';
import { dueDayCutoff } from '../src/lib/invoiceDate';
test('vencimento respeita o dia de Brasília inclusive na virada UTC', () => {
  assert.equal(dueDayCutoff(new Date('2026-11-22T02:59:59Z')).toISOString(), '2026-11-21T00:00:00.000Z');
  assert.equal(dueDayCutoff(new Date('2026-11-22T03:00:00Z')).toISOString(), '2026-11-22T00:00:00.000Z');
});
