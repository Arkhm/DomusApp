import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { listVotings } from '../services/votingService';
import { toApiFailure, type ApiFailure } from '../services/api';
import type { Voting } from '../types';

const ORDER = { OPEN: 0, SCHEDULED: 1, CLOSED: 2 } as const;

/** Abertas (as que encerram antes primeiro), agendadas, e encerradas (mais recentes primeiro). */
function byRelevance(a: Voting, b: Voting): number {
  if (a.status !== b.status) return ORDER[a.status] - ORDER[b.status];
  if (a.status === 'OPEN') return Date.parse(a.endDate) - Date.parse(b.endDate);
  if (a.status === 'SCHEDULED') return Date.parse(a.startDate) - Date.parse(b.startDate);
  return Date.parse(b.endDate) - Date.parse(a.endDate);
}

export function useVotings() {
  const [votings, setVotings] = useState<Voting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (refresh = false) => {
    const id = ++requestId.current;
    if (refresh) setRefreshing(true);
    try {
      const data = await listVotings();
      if (id !== requestId.current) return;
      setVotings(data.sort(byRelevance));
      setFailure(null);
    } catch (error) {
      if (id === requestId.current) setFailure(toApiFailure(error, 'Não foi possível carregar as votações.'));
    } finally {
      if (id === requestId.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { requestId.current += 1; };
  }, [load]));

  return { votings, loading, refreshing, failure, reload: () => void load(true) };
}
