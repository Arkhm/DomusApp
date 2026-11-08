import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { toApiFailure, type ApiFailure } from '../services/api';
import { listNotifications, markNotificationRead } from '../services/notificationService';
import type { AppNotification } from '../types/notification';

export function useNotifications() {
  const { user } = useAuth();
  const userId = user?.id;
  const [inbox, setInbox] = useState<{ userId: string; items: AppNotification[] } | null>(null);
  const items = inbox && inbox.userId === userId ? inbox.items : [];
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const request = useRef(0);
  const focus = useRef(0);
  const active = useRef(false);
  const opening = useRef(false);

  const load = useCallback(async (refresh: boolean) => {
    if (!active.current || !userId) return;
    const id = ++request.current;
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const data = await listNotifications();
      if (id !== request.current || !active.current) return;
      setInbox({ userId, items: data });
      setFailure(null);
    } catch (error) {
      if (id === request.current && active.current) {
        setFailure(toApiFailure(error, 'Não foi possível carregar as notificações.'));
      }
    } finally {
      if (id === request.current && active.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    active.current = true;
    focus.current += 1;
    opening.current = false;
    setOpeningId(null);
    setIsRefreshing(false);
    setFailure(null);
    void load(false);
    return () => {
      active.current = false;
      focus.current += 1;
      request.current += 1;
    };
  }, [load]));

  const reload = useCallback(() => { void load(true); }, [load]);

  const markRead = useCallback(async (item: AppNotification): Promise<boolean> => {
    if (!active.current || opening.current) return false;
    if (item.isRead) return true;
    const currentFocus = focus.current;
    opening.current = true;
    setOpeningId(item.id);
    try {
      await markNotificationRead(item);
      if (!active.current || currentFocus !== focus.current) return false;
      // Uma consulta iniciada antes da leitura não pode desfazer o resultado.
      request.current += 1;
      setInbox(current => current ? { ...current,
        items: current.items.map(entry => entry.id === item.id ? { ...entry, isRead: true } : entry),
      } : null);
      setIsLoading(false);
      setIsRefreshing(false);
      setFailure(null);
      return true;
    } catch (error) {
      if (active.current && currentFocus === focus.current) {
        setFailure(toApiFailure(error, 'Não foi possível abrir a notificação.'));
      }
      return false;
    } finally {
      if (currentFocus === focus.current) {
        opening.current = false;
        setOpeningId(null);
      }
    }
  }, []);

  return { items, isLoading, isRefreshing, failure, openingId, reload, markRead,
    unreadCount: items.filter(item => !item.isRead).length };
}

/** Para o badge da Home; atualiza sempre que a tela recebe foco. */
export function useUnreadNotifications() {
  const { unreadCount, isLoading, isRefreshing, failure, reload } = useNotifications();
  return { unreadCount: isLoading || failure ? null : unreadCount, isLoading, isRefreshing, failure, reload };
}
