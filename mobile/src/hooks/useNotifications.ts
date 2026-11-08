import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { toApiFailure, type ApiFailure } from '../services/api';
import { listNotifications, resolveNotificationTarget, type NotificationTarget } from '../services/notificationService';
import type { AppNotification } from '../types/notification';

export function useNotifications() {
  const { user } = useAuth();
  const userId = user?.id;
  const unitId = user?.unitId ?? null;
  const [inbox, setInbox] = useState<{ userId: string; unitId: string | null; items: AppNotification[] } | null>(null);
  const items = inbox && inbox.userId === userId && inbox.unitId === unitId ? inbox.items : [];
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
      setInbox({ userId, unitId, items: data });
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
  }, [userId, unitId]);

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

  const loadTarget = useCallback(async (item: AppNotification): Promise<NotificationTarget | null> => {
    if (!active.current || opening.current || !userId) return null;
    const currentFocus = focus.current;
    opening.current = true;
    setOpeningId(item.id);
    try {
      const target = await resolveNotificationTarget(item, unitId);
      if (!active.current || currentFocus !== focus.current) return null;
      setFailure(null);
      return target;
    } catch (error) {
      if (active.current && currentFocus === focus.current) {
        setFailure(toApiFailure(error, 'Não foi possível abrir a notificação.'));
      }
      return null;
    } finally {
      if (currentFocus === focus.current) {
        opening.current = false;
        setOpeningId(null);
      }
    }
  }, [userId, unitId]);

  return { items, isLoading, isRefreshing, failure, openingId, reload, loadTarget,
    unreadCount: items.filter(item => !item.isRead).length };
}

/** Para o badge da Home; atualiza sempre que a tela recebe foco. */
export function useUnreadNotifications() {
  const { unreadCount, isLoading, isRefreshing, failure, reload } = useNotifications();
  return { unreadCount: isLoading || failure ? null : unreadCount, isLoading, isRefreshing, failure, reload };
}
