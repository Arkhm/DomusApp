import { unitRepository } from '../repositories/unitRepository';
import { vehicleRepository } from '../repositories/vehicleRepository';

type UnitType = 'APARTMENT' | 'HOUSE';
const VALID_TYPES: ReadonlyArray<UnitType> = ['APARTMENT', 'HOUSE'];

function isValidType(s: string): s is UnitType {
  return (VALID_TYPES as ReadonlyArray<string>).includes(s);
}

function parseParkingSpots(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const spots = Number(value);
  if (!Number.isInteger(spots) || spots < 0 || spots > 20) {
    throw new Error('Quantidade de vagas inválida. Use um número inteiro entre 0 e 20.');
  }
  return spots;
}

export const unitService = {
  async create(data: { type?: string; block?: string; number: string; parkingSpots?: number }) {
    if (!data.number) {
      throw new Error('O número da unidade é obrigatório.');
    }

    const upper = (data.type || 'APARTMENT').toUpperCase();
    if (!isValidType(upper)) {
      throw new Error('Tipo de unidade inválido. Use APARTMENT ou HOUSE.');
    }
    const type: UnitType = upper;

    const existingUnit = await unitRepository.findByBlockAndNumber(
      data.block || null,
      data.number,
      type,
    );
    if (existingUnit) {
      const label = type === 'HOUSE' ? 'casa' : 'apartamento';
      throw new Error(`Já existe um(a) ${label} com este bloco/quadra e número.`);
    }

    return await unitRepository.create({
      type,
      block: data.block || null,
      number: data.number,
      parkingSpots: parseParkingSpots(data.parkingSpots) ?? 0,
    });
  },

  async listAll() {
    return await unitRepository.findAll();
  },

  async update(id: string, data: { type?: string; block?: string; number?: string; parkingSpots?: number }) {
    const unit = await unitRepository.findById(id);

    if (!unit) {
      throw new Error('Unidade não encontrada.');
    }

    let typeToUpdate = unit.type as UnitType;
    if (data.type) {
      const upper = data.type.toUpperCase();
      if (!isValidType(upper)) {
        throw new Error('Tipo de unidade inválido. Use APARTMENT ou HOUSE.');
      }
      typeToUpdate = upper;
    }

    const blockToUpdate = data.block !== undefined ? (data.block || null) : unit.block;
    const numberToUpdate = data.number !== undefined ? data.number : unit.number;

    if (typeToUpdate !== unit.type || blockToUpdate !== unit.block || numberToUpdate !== unit.number) {
      const existingUnit = await unitRepository.findByBlockAndNumber(
        blockToUpdate,
        numberToUpdate,
        typeToUpdate
      );

      if (existingUnit && existingUnit.id !== id) {
        const label = typeToUpdate === 'HOUSE' ? 'casa' : 'apartamento';
        throw new Error(`Já existe um(a) ${label} com este bloco/quadra e número.`);
      }
    }

    const spotsToUpdate = parseParkingSpots(data.parkingSpots) ?? unit.parkingSpots;
    if (spotsToUpdate < unit.parkingSpots) {
      const vehicles = await vehicleRepository.countByUnit(id);
      if (vehicles > spotsToUpdate) {
        throw new Error(
          `Esta unidade tem ${vehicles} veículo(s) cadastrado(s). Remova veículos antes de reduzir as vagas para ${spotsToUpdate}.`,
        );
      }
    }

    return await unitRepository.update(id, {
      type: typeToUpdate,
      block: blockToUpdate,
      number: numberToUpdate,
      parkingSpots: spotsToUpdate,
    });
  },

  async delete(id: string) {
    const unit = await unitRepository.findById(id);

    if (!unit) {
      throw new Error('Unidade não encontrada.');
    }

    if (unit.residents && unit.residents.length > 0) {
      throw new Error(
        'Não é possível excluir esta unidade pois existem moradores vinculados a ela. Remova ou transfira os moradores primeiro.',
      );
    }

    await unitRepository.delete(id);
    return { message: 'Unidade removida com sucesso.' };
  },
};