const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

const exportsObject = {};
const source = readFileSync(join(__dirname, 'residentForms.ts'), 'utf8');
runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: exportsObject });
const { validateReservation, canCancelReservation, formatReservationDate, validateIncident } = exportsObject;
const now = Date.parse('2030-01-01T12:00:00Z');
const input = { commonAreaId: 'area', date: '2030-01-02', startTime: '14:00', endTime: '15:00' };

test('aceita reserva futura e exige área ativa selecionada', () => {
  assert.equal(validateReservation(input, now), null);
  assert.match(validateReservation({ ...input, commonAreaId: '' }, now), /área/);
});

test('rejeita datas inexistentes e formatos diferentes do contrato', () => {
  for (const date of ['2030-02-29', '2030-04-31', '2030-13-01', '02-01-2030', '2030-1-02', '']) {
    assert.match(validateReservation({ ...input, date }, now), /data válida/);
  }
  assert.equal(validateReservation({ ...input, date: '2032-02-29' }, now), null);
});

test('valida formato, limites e ordem dos horários', () => {
  for (const startTime of ['24:00', '14:60', '9:00', '14:00:00', '']) {
    assert.match(validateReservation({ ...input, startTime }, now), /horários/);
  }
  assert.match(validateReservation({ ...input, endTime: '24:00' }, now), /horários/);
  for (const endTime of ['14:00', '13:59']) {
    assert.match(validateReservation({ ...input, endTime }, now), /depois/);
  }
  assert.equal(validateReservation({ ...input, startTime: '00:00', endTime: '23:59' }, now), null);
});

test('interpreta início no UTC-03 fixo e bloqueia o início já alcançado', () => {
  const sameDay = { ...input, date: '2030-01-01', startTime: '09:00', endTime: '10:00' };
  assert.equal(validateReservation(sameDay, now - 1), null);
  assert.match(validateReservation(sameDay, now), /futuro/);
  assert.match(validateReservation(sameDay, now + 1), /futuro/);
});

test('cancelamento exige dono, estado permitido e início futuro', () => {
  const reservation = { ...input, date: '2030-01-01T00:00:00.000Z', startTime: '09:00', user: { id: 'morador' }, status: 'PENDING' };
  for (const status of ['PENDING', 'APPROVED']) {
    assert.equal(canCancelReservation({ ...reservation, status }, 'morador', now - 1), true);
  }
  for (const status of ['REJECTED', 'CANCELLED']) {
    assert.equal(canCancelReservation({ ...reservation, status }, 'morador', now - 1), false);
  }
  assert.equal(canCancelReservation(reservation, 'outro', now - 1), false);
  assert.equal(canCancelReservation(reservation, 'morador', now), false);
  assert.equal(canCancelReservation(reservation, 'morador', now + 1), false);
});

test('exibe o dia da API sem deslocar para a véspera em Brasília', () => {
  assert.equal(formatReservationDate('2030-01-02T00:00:00.000Z'), '02/01/2030');
});

test('valida campos obrigatórios, limite do título e categorias de ocorrência', () => {
  const incident = { title: 'Lâmpada', description: 'Lâmpada apagada no corredor.', category: 'MANUTENCAO' };
  for (const category of ['BARULHO', 'MANUTENCAO', 'SEGURANCA', 'LIMPEZA', 'OUTRO']) {
    assert.equal(validateIncident({ ...incident, category }), null);
  }
  assert.match(validateIncident({ ...incident, title: ' ' }), /título/);
  assert.equal(validateIncident({ ...incident, title: 'á'.repeat(200) }), null);
  assert.match(validateIncident({ ...incident, title: 'á'.repeat(201) }), /título/);
  assert.match(validateIncident({ ...incident, description: ' ' }), /Descreva/);
  assert.match(validateIncident({ ...incident, category: 'ADMIN' }), /categoria/);
});
