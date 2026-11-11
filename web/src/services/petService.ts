import api from './api';
import type { Pet, PetCreateInput, PetFilters, PetInput } from '../types/pet';

export const petService = {
    getAll: async (params: PetFilters = {}) => (await api.get<Pet[]>('/pets', { params })).data,
    create: async (data: PetCreateInput) => { await api.post('/pets', data); },
    update: async (id: string, data: PetInput) => { await api.put(`/pets/${encodeURIComponent(id)}`, data); },
    delete: async (id: string) => { await api.delete(`/pets/${encodeURIComponent(id)}`); },
};
