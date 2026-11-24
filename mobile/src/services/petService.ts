import { api } from './api';
import { PET_SIZES, PET_SPECIES, type Pet, type PetInput } from '../types/vehiclePet';

export function validatePetInput(input: { name: string; species: string; size: string }): string | null {
  if (!input.name.trim() || input.name.trim().length > 191) {
    return 'Informe o nome do pet com até 191 caracteres.';
  }
  if (!PET_SPECIES.some((item) => item.value === input.species.toUpperCase())) {
    return 'Escolha a espécie do pet.';
  }
  if (!PET_SIZES.some((item) => item.value === input.size.toUpperCase())) {
    return 'Escolha o porte do pet.';
  }
  return null;
}

export async function listPets(): Promise<Pet[]> {
  const { data } = await api.get<Pet[]>('/pets/me');
  return data;
}

export async function createPet(input: PetInput): Promise<Pet> {
  const { name, species, size } = input;
  const { data } = await api.post<Pet>('/pets', {
    name: name.trim(), species: species.toUpperCase(), size: size.toUpperCase(),
  });
  return data;
}

export async function updatePet(id: string, input: PetInput): Promise<Pet> {
  const { name, species, size } = input;
  const { data } = await api.put<Pet>(`/pets/${encodeURIComponent(id)}`, {
    name: name.trim(), species: species.toUpperCase(), size: size.toUpperCase(),
  });
  return data;
}

export async function deletePet(id: string): Promise<void> {
  await api.delete<{ message: string }>(`/pets/${encodeURIComponent(id)}`);
}
