import { api } from './api';
import type { CommonArea } from '../types';

export async function listCommonAreas(): Promise<CommonArea[]> {
  const { data } = await api.get<CommonArea[]>('/common-areas');
  return data;
}
