import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useResource } from './use-resource';
import type { Adventure, CatalogItem, AdventureUpdate } from '../../shared/contracts';
export function useAdventures() {
  const resource = useResource(
      async (signal) => {
        const capabilities = await api.capabilities(signal);
        if (capabilities.profileMode === 'disabled')
          return { ...capabilities, authenticated: false, items: [] as Adventure[] };
        try {
          return { ...capabilities, authenticated: true, items: await api.adventures(signal) };
        } catch (error) {
          if (
            capabilities.profileMode === 'access' &&
            (error instanceof TypeError ||
              (error instanceof ApiError && [401, 403].includes(error.status)))
          )
            return { ...capabilities, authenticated: false, items: [] as Adventure[] };
          throw error;
        }
      },
      [],
      true,
    ),
    [pending, setPending] = useState(false),
    [mutationError, setMutationError] = useState<string | null>(null);
  const items = resource.data?.items ?? [];
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
    canSave: resource.data?.authenticated ?? false,
    profileMode: resource.data?.profileMode ?? 'disabled',
    needsSignIn: resource.data?.profileMode === 'access' && !resource.data.authenticated,
    signInUrl: resource.data?.signInUrl ?? null,
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
