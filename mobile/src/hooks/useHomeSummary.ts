import { useCallback, useEffect, useRef, useState } from 'react';
import { listNotices, countUnread } from '../services/noticeService';
import { findNextEvent, listEvents } from '../services/eventService';
import { toApiFailure, type ApiFailure } from '../services/api';
import type { CondoEvent, Notice } from '../types';

export interface HomeSummary {
  /**
   * Avisos não lidos. `null` quando a API não informa leitura para o perfil
   * logado (na visão de painel o `isRead` não é enviado).
   */
  unreadNotices: number | null;
  totalNotices: number;
  nextEvent: CondoEvent | null;
}

interface UseHomeSummaryResult {
  summary: HomeSummary;
  isLoading: boolean;
  isRefreshing: boolean;
  failure: ApiFailure | null;
  reload: () => void;
}

const EMPTY_SUMMARY: HomeSummary = {
  unreadNotices: null,
  totalNotices: 0,
  nextEvent: null,
};

function buildSummary(notices: Notice[], events: CondoEvent[]): HomeSummary {
  const reportsReadState = notices.some((notice) => typeof notice.isRead === 'boolean');
  return {
    unreadNotices: reportsReadState ? countUnread(notices) : null,
    totalNotices: notices.length,
    nextEvent: findNextEvent(events),
  };
}

/**
 * Resumo do topo da Home: avisos e próximo evento.
 *
 * Toda a comunicação com a API vive aqui — a tela só consome o resultado.
 * Com a API fora, devolve `failure` preenchido e o resumo vazio, sem quebrar.
 */
export function useHomeSummary(): UseHomeSummaryResult {
  const [summary, setSummary] = useState<HomeSummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'refresh') setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [notices, events] = await Promise.all([listNotices(), listEvents()]);
      if (!isMounted.current) return;
      setSummary(buildSummary(notices, events));
      setFailure(null);
    } catch (error) {
      if (!isMounted.current) return;
      setSummary(EMPTY_SUMMARY);
      setFailure(toApiFailure(error, 'Não foi possível carregar o resumo do condomínio.'));
    } finally {
      if (!isMounted.current) return;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load('initial');
  }, [load]);

  const reload = useCallback(() => {
    void load('refresh');
  }, [load]);

  return { summary, isLoading, isRefreshing, failure, reload };
}
