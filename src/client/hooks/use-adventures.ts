import { useState } from 'react';
import { api } from '../lib/api';
import { useResource } from './use-resource';
import type { Adventure, CatalogItem, AdventureUpdate } from '../../shared/contracts';
export function useAdventures() {
  const resource = useResource((signal) => api.adventures(signal), [], true),
    [pending, setPending] = useState(false),
    [mutationError, setMutationError] = useState<string | null>(null);
  const items = resource.data ?? [];
  async function mutate(action: () => Promise<unknown>) {
    if (pending) return;
    setPending(true);
    setMutationError(null);
    try {
      await action();
      resource.retry();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Salvataggio non riuscito.');
    } finally {
      setPending(false);
    }
  }
  return {
    items,
    loading: resource.loading,
    pending,
    error: mutationError ?? resource.error,
    retry: resource.retry,
    saved: (item: CatalogItem) => items.find((entry) => entry.item.key === item.key),
    toggle: (item: CatalogItem) => {
      const previous = items.find((entry) => entry.item.key === item.key);
      return mutate(() =>
        previous ? api.remove(previous.id) : api.save({ kind: item.kind, targetId: item.id }),
      );
    },
    update: (entry: Adventure, changes: AdventureUpdate) =>
      mutate(() => api.update(entry.id, changes)),
    remove: (entry: Adventure) => mutate(() => api.remove(entry.id)),
  };
}
export type AdventuresState = ReturnType<typeof useAdventures>;
