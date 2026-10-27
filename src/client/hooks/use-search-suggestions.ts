import { useEffect, useState } from 'react';
import type { CatalogItem } from '../../shared/contracts';
import { api } from '../lib/api';

/** Debounce requests and discard responses belonging to older input or activity filters. */
export function useSearchSuggestions(value: string, activity: string, enabled: boolean) {
  const query = value.trim();
  const [result, setResult] = useState<{
    key: string;
    items: CatalogItem[];
    loading: boolean;
    error: boolean;
  } | null>(null);
  const key = JSON.stringify([query, activity]);
  const ready = enabled && query.length >= 2;
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setResult({ key, items: [], loading: true, error: false });
      void api
        .suggestions(
          {
            q: query,
            kind: activity === 'mountain' ? 'mountain' : activity ? 'route' : undefined,
            activityId: activity && activity !== 'mountain' ? Number(activity) : undefined,
          },
          controller.signal,
        )
        .then((page) => {
          if (!controller.signal.aborted)
            setResult({ key, items: page.items, loading: false, error: false });
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setResult({ key, items: [], loading: false, error: true });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, ready]);
  const current = ready && result?.key === key ? result : null;
  return {
    items: current?.items ?? [],
    loading: ready && (!current || current.loading),
    error: current?.error ?? false,
  };
}
