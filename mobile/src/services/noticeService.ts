import { api } from './api';
import type { Notice } from '../types';

/**
 * `GET /notices` → `Notice[]`.
 *
 * A forma da resposta depende do papel de quem chama (api/src/services/noticeService.ts):
 *  - painel (ADMIN/FUNCIONARIO/síndica): tudo, inclusive DRAFT, com
 *    `readCount` e `totalAddressees`;
 *  - morador comum: apenas PUBLISHED direcionados a ele, com `isRead`.
 */
export async function listNotices(): Promise<Notice[]> {
  const { data } = await api.get<Notice[]>('/notices');
  return data;
}

/** `POST /notices/:id/read` → `{ message: string }`. */
export async function markNoticeAsRead(id: string): Promise<void> {
  await api.post(`/notices/${id}/read`);
}

/**
 * Avisos que o morador ainda não leu.
 *
 * `isRead` só vem na visão de morador. Na visão de painel a API não diz se
 * *aquele* usuário leu, então não há como contar não lidos — retornamos 0 em
 * vez de inventar um número.
 */
export function countUnread(notices: Notice[]): number {
  return notices.filter((notice) => notice.isRead === false).length;
}
