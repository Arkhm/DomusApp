import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { toApiFailure } from '../services/api';
import { getInvoiceStats, loadInvoicePage } from '../services/invoiceService';
import type { Invoice, InvoiceFilter, InvoiceStats } from '../types/invoice';

export function useInvoices() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<InvoiceFilter>('open');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const loadingMore = useRef(false);
  const page = useRef(1);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useFocusEffect(useCallback(() => {
    const request = ++generation.current;
    setIsLoading(true);
    setIsLoadingMore(false);
    loadingMore.current = false;
    setError(null);
    setStatsError(null);
    setMoreError(null);
    setInvoices([]);
    setStats(null);
    setHasMore(false);
    page.current = 1;
    void loadInvoicePage(filter, 1).then((result) => {
      if (request !== generation.current) return;
      setInvoices([...new Map(result.invoices.map((invoice) => [invoice.id, invoice])).values()]);
      setHasMore(result.hasMore);
    }).catch((failure: unknown) => {
      if (request === generation.current) setError(toApiFailure(failure, 'Não foi possível carregar as cobranças.').message);
    }).finally(() => {
      if (request === generation.current) setIsLoading(false);
    });
    void getInvoiceStats().then((result) => {
      if (request === generation.current) setStats(result);
    }).catch((failure: unknown) => {
      if (request === generation.current) setStatsError(toApiFailure(failure, 'Não foi possível carregar o resumo.').message);
    });
    return () => { generation.current += 1; };
  }, [filter, revision, user?.id]));

  const loadMore = useCallback(async () => {
    if (isLoading || loadingMore.current || !hasMore) return;
    const request = generation.current;
    loadingMore.current = true;
    setIsLoadingMore(true);
    setMoreError(null);
    try {
      const result = await loadInvoicePage(filter, page.current + 1);
      if (request !== generation.current) return;
      setInvoices((current) => [...new Map([...current, ...result.invoices].map((invoice) => [invoice.id, invoice])).values()]);
      page.current += 1;
      setHasMore(result.hasMore);
    } catch (failure) {
      if (request === generation.current) setMoreError(toApiFailure(failure, 'Não foi possível carregar mais cobranças.').message);
    } finally {
      if (request === generation.current) {
        loadingMore.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [filter, hasMore, isLoading]);

  return { invoices, stats, filter, setFilter, isLoading, isLoadingMore, error, statsError, moreError, hasMore, reload, loadMore };
}
