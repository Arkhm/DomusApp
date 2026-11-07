import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { validate } from '../src/middlewares/validate';
import { idParamsSchema } from '../src/schemas/common';
import { createPetSchema } from '../src/schemas/petSchema';
import { createVehicleSchema } from '../src/schemas/vehicleSchema';
import { createUnitSchema } from '../src/schemas/unitSchema';
import { invoiceQuerySchema, webhookBodySchema, webhookQuerySchema } from '../src/schemas/invoiceSchema';
import { loginSchema, resetPasswordSchema } from '../src/schemas/authSchema';

function response() {
  return { statusCode: 200, body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
}

test('validate sanitiza body e chama next apenas com dados válidos', () => {
  const req = { body: { name: '  Luna  ', species: 'gato', size: 'pequeno', ownerId: 'injetado' } } as Request;
  const res = response(); let next = 0;
  validate(createPetSchema)(req, res as unknown as Response, () => { next++; });
  assert.deepEqual(req.body, { name: 'Luna', species: 'GATO', size: 'PEQUENO' });
  assert.equal(next, 1);
  req.body = { name: { contains: '' } };
  validate(createPetSchema)(req, res as unknown as Response, () => { next++; });
  assert.equal(next, 1); assert.equal(res.statusCode, 400);
  assert.equal(typeof res.body.error, 'string'); assert.ok(res.body.errors);
});

test('validate cobre params e query inclusive o getter do Express 5', () => {
  const req = { params: { id: 'invalido' } } as unknown as Request;
  const res = response(); let next = 0;
  validate(idParamsSchema, 'params')(req, res as unknown as Response, () => { next++; });
  assert.equal(res.statusCode, 400); assert.equal(next, 0);
  req.params.id = 'e4776e30-e812-4d63-aa2d-07c0dccf5551';
  validate(idParamsSchema, 'params')(req, res as unknown as Response, () => { next++; });
  Object.defineProperty(req, 'query', { get: () => ({ page: '2', extra: 'discard' }), configurable: true });
  validate(z.object({ page: z.coerce.number().int().positive() }), 'query')(req, res as unknown as Response, () => { next++; });
  assert.deepEqual(req.query, { page: 2 }); assert.equal(next, 2);
});

test('schemas adicionais impedem edição manual de vagas e rejeitam filtros e placas malformados', () => {
  assert.equal(createUnitSchema.safeParse({ number: '1', parkingSpots: '2' }).success, false);
  assert.equal(createUnitSchema.safeParse({ number: '1', parkingSpots: true }).success, false);
  assert.equal(createVehicleSchema.parse({ plate: 'abc-1234', model: 'Carro' }).plate, 'ABC1234');
  for (const query of [{ page: '0' }, { limit: '101' }, { status: ['PAID'] }, { startDate: '2026-02-30' },
    { startDate: '2026-10-02', endDate: '2026-10-01' }]) {
    assert.equal(invoiceQuerySchema.safeParse(query).success, false);
  }
  assert.equal(invoiceQuerySchema.safeParse({ page: '1', limit: '100', status: 'PAID' }).success, true);
});

test('webhook valida formato sem normalizar nem remover dados assinados', () => {
  const body = { type: 'order', data: { id: 'ORD-AbC', extra: 'keep' }, live_mode: false, user_id: '123', action: 'order.updated' };
  assert.deepEqual(webhookBodySchema.parse(body), body);
  assert.deepEqual(webhookQuerySchema.parse({ 'data.id': 'ORD-AbC' }), { 'data.id': 'ORD-AbC' });
  assert.equal(webhookBodySchema.safeParse({ data: { id: {} } }).success, false);
  assert.equal(webhookQuerySchema.safeParse({ 'data.id': ['ORD-AbC'] }).success, false);
});

test('schemas de auth preservam espaços da senha e rejeitam tipos/bytes inválidos', () => {
  assert.equal(loginSchema.parse({ email: 'a@b.com', password: ' senha ' }).password, ' senha ');
  const input = { token: 'e4776e30-e812-4d63-aa2d-07c0dccf5551', newPassword: ' senha nova ' };
  assert.equal(resetPasswordSchema.parse(input).newPassword, input.newPassword);
  assert.equal(resetPasswordSchema.safeParse({ ...input, newPassword: 'é'.repeat(37) }).success, false);
  assert.equal(resetPasswordSchema.safeParse({ ...input, newPassword: {} }).success, false);
});
