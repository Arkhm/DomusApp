import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { listNotices } from '../services/noticeService';
import { toApiFailure, type ApiFailure } from '../services/api';
import type { Notice } from '../types';

export function useNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (refresh = false) => {
    const id = ++requestId.current;
    if (refresh) setRefreshing(true);
    try {
      const data = await listNotices();
      if (id !== requestId.current) return;
      setNotices(data.filter((notice) => notice.status === 'PUBLISHED')
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
      setFailure(null);
    } catch (error) {
      if (id === requestId.current) setFailure(toApiFailure(error, 'Não foi possível carregar os comunicados.'));
    } finally {
      if (id === requestId.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { requestId.current += 1; };
  }, [load]));

  return { notices, loading, refreshing, failure, reload: () => void load(true) };
}
