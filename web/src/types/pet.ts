import type { Unit } from './user';

export type PetSpecies = 'CACHORRO' | 'GATO' | 'PASSARO' | 'OUTRO';
export type PetSize = 'PEQUENO' | 'MEDIO' | 'GRANDE';
export const PET_SPECIES_LABELS: Record<PetSpecies, string> = {
    CACHORRO: 'Cachorro', GATO: 'Gato', PASSARO: 'Pássaro', OUTRO: 'Outro',
};
export const PET_SIZE_LABELS: Record<PetSize, string> = {
    PEQUENO: 'Pequeno', MEDIO: 'Médio', GRANDE: 'Grande',
};
export interface Pet {
    id: string;
    name: string;
    species: PetSpecies;
    size: PetSize;
    ownerId: string;
    owner: { id: string; name: string; phone: string | null; unit: Unit | null };
}
export interface PetInput { name: string; species: PetSpecies; size: PetSize }
export interface PetCreateInput extends PetInput { ownerId: string }
export interface PetFilters { search?: string; species?: PetSpecies; size?: PetSize; block?: string; unitId?: string }
