import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { listNotifications, markNotificationRead, type AppNotification } from '../services/notificationService';
import { toApiFailure, type ApiFailure } from '../services/api';

export function useNotifications() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const request = useRef(0);
  const mounted = useRef(true);
  const opening = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; request.current += 1; };
  }, []);

  const reload = useCallback(async () => {
    const id = ++request.current;
    setRefreshing(true);
    try {
      const data = await listNotifications();
      if (id === request.current && mounted.current) { setItems(data); setFailure(null); }
    } catch (error) {
      if (id === request.current && mounted.current) setFailure(toApiFailure(error, 'Não foi possível carregar as notificações.'));
    } finally {
      if (id === request.current && mounted.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const markRead = useCallback(async (item: AppNotification): Promise<boolean> => {
    if (opening.current) return false;
    if (item.isRead) return true;
    opening.current = true;
    setOpeningId(item.id);
    try {
      await markNotificationRead(item);
      if (!mounted.current) return false;
      request.current += 1; // Uma consulta anterior não pode desfazer a leitura confirmada.
      setRefreshing(false);
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry));
      setFailure(null);
      return true;
    } catch (error) {
      if (mounted.current) setFailure(toApiFailure(error, 'Não foi possível abrir a notificação.'));
      return false;
    } finally {
      opening.current = false;
      if (mounted.current) setOpeningId(null);
    }
  }, []);

  return { items, loading, refreshing, failure, openingId, reload, markRead,
    unread: items.filter((item) => !item.isRead).length };
}
export type NotificationsInbox = ReturnType<typeof useNotifications>;
