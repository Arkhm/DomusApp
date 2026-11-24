import { api } from './api';
import type { Vehicle, VehicleInput } from '../types/vehiclePet';

export function normalizePlate(plate: string): string {
  return plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function validateVehicleInput(input: VehicleInput): string | null {
  if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalizePlate(input.plate))) {
    return 'Informe uma placa válida, como ABC1234 ou ABC1D23.';
  }
  if (!input.model.trim() || input.model.trim().length > 191) {
    return 'Informe o modelo com até 191 caracteres.';
  }
  if ((input.color?.trim().length ?? 0) > 191) return 'A cor deve ter até 191 caracteres.';
  return null;
}

/** A API retorna todos os veículos da unidade do morador, sem envelope. */
export async function listVehicles(): Promise<Vehicle[]> {
  const { data } = await api.get<Vehicle[]>('/vehicles/me');
  return data;
}

/** A capacidade vem do perfil, não da lista de veículos. */
export async function getVehicleParkingSpots(): Promise<number | null> {
  const { data } = await api.get<{ user: { unit?: { parkingSpots?: number } | null } }>('/auth/me');
  const value = data.user.unit?.parkingSpots;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

export async function createVehicle(input: VehicleInput): Promise<Vehicle> {
  const { data } = await api.post<Vehicle>('/vehicles', {
    plate: normalizePlate(input.plate), model: input.model.trim(), color: input.color?.trim(),
  });
  return data;
}

export async function deleteVehicle(id: string): Promise<void> {
  await api.delete<{ message: string }>(`/vehicles/${encodeURIComponent(id)}`);
}
