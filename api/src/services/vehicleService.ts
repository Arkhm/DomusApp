import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/httpError';
import { updateVehicleSchema } from '../schemas/updateSchemas';
import { UpdateActor, requireEditor } from '../lib/access';
import { vehicleRepository } from '../repositories/vehicleRepository';
import { userRepository } from '../repositories/userRepository';
import { unitRepository } from '../repositories/unitRepository';

const PLATE_RX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

function normalizePlate(plate: string) {
  return plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

async function getResidentUnitId(userId: string) {
  const user = await userRepository.findById(userId);
  if (!user) throw new Error('Usuário não encontrado.');
  if (!user.unitId) throw new Error('Você não está vinculado a nenhuma unidade.');
  return user.unitId;
}

export const vehicleService = {
  async update(id: string, input: unknown, actor: UpdateActor) {
    requireEditor(actor, false);
    const data = updateVehicleSchema.parse(input);
    const record = await vehicleRepository.findById(id);
    if (!record) throw new HttpError(404, 'Registro não encontrado.');
    requireEditor(actor, false);
    try { return await vehicleRepository.update(id, data); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new HttpError(409, 'Já existe um veículo cadastrado com esta placa.');
      }
      throw error;
    }
  },

  async listAll(plate?: string) {
    return await vehicleRepository.findAll(plate ? normalizePlate(plate) : undefined);
  },

  async listMine(userId: string) {
    const unitId = await getResidentUnitId(userId);
    return await vehicleRepository.findByUnit(unitId);
  },

  async create(userId: string, data: { plate?: string; model?: string; color?: string }) {
    if (!data.plate || !data.model) {
      throw new Error('Placa e modelo são obrigatórios.');
    }

    const plate = normalizePlate(data.plate);
    if (!PLATE_RX.test(plate)) {
      throw new Error('Placa inválida. Use o formato ABC1234 ou ABC1D23.');
    }

    const model = data.model.trim();
    const unitId = await getResidentUnitId(userId);
    return unitRepository.withLockedUnit(unitId, async tx => {
      const unit = await unitRepository.findById(unitId, tx);
      if (!unit) throw new Error('Unidade não encontrada.');

      if (unit.parkingSpots === 0) {
        throw new Error('Sua unidade não possui vagas cadastradas. Fale com a administração.');
      }

      const count = await vehicleRepository.countByUnit(unitId, tx);
      if (count >= unit.parkingSpots) {
        throw new Error(`Sua unidade tem ${unit.parkingSpots} vaga(s) e todas já estão ocupadas.`);
      }

      if (await vehicleRepository.findByPlate(plate, tx)) {
        throw new Error('Já existe um veículo cadastrado com esta placa.');
      }

      return await vehicleRepository.create({
        plate,
        model,
        color: data.color?.trim() || null,
        unitId,
      }, tx);
    });
  },

  async delete(id: string, userId: string, role: string) {
    const vehicle = await vehicleRepository.findById(id);
    if (!vehicle) throw new Error('Veículo não encontrado.');

    if (role !== 'ADMIN') {
      const user = await userRepository.findById(userId);
      if (!user || user.unitId !== vehicle.unitId) {
        throw new Error('Você não tem permissão para remover este veículo.');
      }
    }

    await vehicleRepository.delete(id);
    return { message: 'Veículo removido com sucesso.' };
  },
};
