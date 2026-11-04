import { api } from './api';
import type { Incident, IncidentInput } from '../types';

export async function listIncidents(): Promise<Incident[]> {
  const { data } = await api.get<Incident[]>('/incidents');
  return data;
}

export async function createIncident(input: IncidentInput): Promise<Incident> {
  const { title, description, category } = input;
  const { data } = await api.post<Incident>('/incidents', { title, description, category });
  return data;
}
