export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  color: string | null;
  unitId: string;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleInput {
  plate: string;
  model: string;
  color?: string;
}

export type PetSpecies = 'CACHORRO' | 'GATO' | 'PASSARO' | 'OUTRO';
export type PetSize = 'PEQUENO' | 'MEDIO' | 'GRANDE';

export interface PetInput {
  name: string;
  species: PetSpecies;
  size: PetSize;
}

export interface Pet extends PetInput {
  id: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export const PET_SPECIES: { value: PetSpecies; label: string }[] = [
  { value: 'CACHORRO', label: 'Cachorro' }, { value: 'GATO', label: 'Gato' },
  { value: 'PASSARO', label: 'Pássaro' }, { value: 'OUTRO', label: 'Outro' },
];
export const PET_SIZES: { value: PetSize; label: string }[] = [
  { value: 'PEQUENO', label: 'Pequeno' }, { value: 'MEDIO', label: 'Médio' },
  { value: 'GRANDE', label: 'Grande' },
];
