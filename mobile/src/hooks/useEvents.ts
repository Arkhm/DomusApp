import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { listEvents } from '../services/eventService';
import { toApiFailure, type ApiFailure } from '../services/api';
import type { CondoEvent } from '../types';

export function useEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CondoEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (refresh = false) => {
    const id = ++requestId.current;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await listEvents();
      if (id !== requestId.current) return;
      setEvents(data.filter((event) =>
        (event.targetType === 'ALL' || (user?.unitId != null && event.targetUnitId === user.unitId)) && event.status !== 'DRAFT')
        .sort((a, b) => Date.parse(a.eventDate) - Date.parse(b.eventDate)));
      setFailure(null);
    } catch (error) {
      if (id === requestId.current) setFailure(toApiFailure(error, 'Não foi possível carregar os eventos.'));
    } finally {
      if (id === requestId.current) { setLoading(false); setRefreshing(false); }
    }
  }, [user?.id, user?.unitId]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { requestId.current += 1; };
  }, [load]));

  return { events, loading, refreshing, failure, reload: () => void load(true) };
}
