import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/httpError';
import { parkingSpotRepository } from '../repositories/parkingSpotRepository';
import { unitRepository } from '../repositories/unitRepository';
import { userRepository } from '../repositories/userRepository';
import { vehicleRepository } from '../repositories/vehicleRepository';
import { createParkingSpotSchema, updateParkingSpotSchema, assignParkingSpotSchema,
  parkingSpotQuerySchema, ParkingSpotInput, ParkingSpotQuery } from '../schemas/parkingSpotSchema';

async function uniqueNumber<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'Já existe uma vaga com este número.');
    }
    throw error;
  }
}
async function findSpot(id: string, tx: Prisma.TransactionClient) {
  const spot = await parkingSpotRepository.findById(id, tx);
  if (!spot) throw new HttpError(404, 'Vaga não encontrada.');
  return spot;
}
async function syncCounters(unitIds: string[], tx: Prisma.TransactionClient) {
  for (const unitId of unitIds) {
    const count = await parkingSpotRepository.countByUnit(unitId, tx);
    const vehicles = await vehicleRepository.countByUnit(unitId, tx);
    if (vehicles > count) {
      throw new HttpError(409, `Esta unidade tem ${vehicles} veículo(s) cadastrado(s). Remova veículos antes de reduzir as vagas para ${count}.`);
    }
    await unitRepository.update(unitId, { parkingSpots: count }, tx);
  }
}

export const parkingSpotService = {
  list: (input: ParkingSpotQuery) => {
    const query = parkingSpotQuerySchema.parse(input);
    return parkingSpotRepository.findAll({
      type: query.type,
      AND: [
        ...(query.unitId ? [{ unitId: query.unitId }] : []),
        ...(query.block !== undefined ? [{ unit: { block: query.block } }] : []),
        ...(query.free !== undefined ? [{ unitId: query.free === 'true' ? null : { not: null } }] : []),
      ],
    });
  },
  listMine: async (userId: string) => {
    const user = await userRepository.findById(userId);
    if (!user) throw new HttpError(404, 'Usuário não encontrado.');
    if (!user.unitId) return [];
    return parkingSpotRepository.findAll({ unitId: user.unitId });
  },
  create: (input: ParkingSpotInput) => uniqueNumber(() => parkingSpotRepository.create(createParkingSpotSchema.parse(input))),
  update: (id: string, input: Partial<ParkingSpotInput>) => {
    const data = updateParkingSpotSchema.parse(input);
    return uniqueNumber(() => parkingSpotRepository.withLockedSpot(id, async tx => {
      const spot = await findSpot(id, tx);
      if (data.type === 'VISITOR' && spot.unitId) {
        throw new HttpError(409, 'Desatribua a vaga antes de alterar o tipo para visitante.');
      }
      return parkingSpotRepository.update(id, data, tx);
    }));
  },
  assign: (id: string, input: { unitId: string | null }) => {
    const { unitId } = assignParkingSpotSchema.parse(input);
    return parkingSpotRepository.withLockedSpot(id, async tx => {
      const spot = await findSpot(id, tx);
      if (unitId && spot.type === 'VISITOR') throw new HttpError(400, 'Vagas de visitante não podem ser atribuídas a unidades.');
      const ids = [...new Set([spot.unitId, unitId].filter((value): value is string => value !== null))].sort();
      await unitRepository.lockUnits(ids, tx);
      if (unitId && !await unitRepository.findById(unitId, tx)) throw new HttpError(404, 'Unidade não encontrada.');
      if (spot.unitId === unitId) return spot;
      const result = await parkingSpotRepository.update(id, { unitId }, tx);
      await syncCounters(ids, tx);
      return result;
    });
  },
  delete: (id: string) => parkingSpotRepository.withLockedSpot(id, async tx => {
    const spot = await findSpot(id, tx);
    const ids = spot.unitId ? [spot.unitId] : [];
    await unitRepository.lockUnits(ids, tx);
    await parkingSpotRepository.delete(id, tx);
    await syncCounters(ids, tx);
    return { message: 'Vaga removida com sucesso.' };
  }),
};
