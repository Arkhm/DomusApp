import test from 'node:test';
import assert from 'node:assert/strict';
import { selectorRepository } from '../src/repositories/selectorRepository';
import { selectorService } from '../src/services/selectorService';
test('seletor financeiro expõe elegibilidade sem CPF nem e-mail', async t => {
  t.mock.method(selectorRepository, 'payers', async () => [{ id: 'resident', name: 'Morador', cpf: '12345678901', email: 'resident@example.test', status: 'ACTIVE', unitId: 'unit', unit: { id: 'unit', type: 'APARTMENT', block: 'A', number: '1' } }]);
  const [payer] = await selectorService.payers();
  assert.deepEqual(Object.keys(payer!).sort(), ['eligible', 'id', 'issue', 'name', 'unit', 'unitId']);
  assert.equal(payer!.eligible, true);
});
