import { prisma } from '../lib/prisma';
export const selectorRepository = {
  payers: () => prisma.user.findMany({ where: { role: 'MORADOR' }, select: { id: true, name: true, email: true, cpf: true, status: true, unitId: true, unit: { select: { id: true, type: true, block: true, number: true } } } }),
  units: () => prisma.unit.findMany({ select: { id: true, type: true, number: true, block: true }, orderBy: { number: 'asc' } }),
};
