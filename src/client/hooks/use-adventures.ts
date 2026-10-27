import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { prepareFavouriteSignIn, takeFavouriteSignIn } from '../lib/favourite-auth';
import { useResource } from './use-resource';
import type {
  Adventure,
  CatalogItem,
  AdventureInput,
  AdventureUpdate,
} from '../../shared/contracts';
const needsAuthentication = (error: unknown) =>
  error instanceof TypeError || (error instanceof ApiError && [401, 403].includes(error.status));

export function useAdventures() {
  const resource = useResource(async (signal) => {
    const capabilities = await api.capabilities(signal);
    if (capabilities.profileMode === 'disabled')
      return { ...capabilities, authenticated: false, items: [] as Adventure[] };
    try {
      return { ...capabilities, authenticated: true, items: await api.adventures(signal) };
    } catch (error) {
      if (capabilities.profileMode === 'access' && needsAuthentication(error))
        return { ...capabilities, authenticated: false, items: [] as Adventure[] };
      throw error;
    }
  }, []);
  const [pending, setPending] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [signInRequest, setSignInRequest] = useState<CatalogItem | 'profile' | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [resumeTarget, setResumeTarget] = useState<AdventureInput | null>(null);
  const busy = useRef(false),
    resumed = useRef(false);
  const authenticated = !!resource.data?.authenticated && !sessionExpired;
  const items = authenticated ? (resource.data?.items ?? []) : [];
  useEffect(() => {
    if (resource.data?.authenticated) setSessionExpired(false);
  }, [resource.data]);
  useEffect(() => {
    const refresh = () => resource.retry();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  async function mutate(action: () => Promise<unknown>, target?: CatalogItem) {
    if (busy.current) return false;
    busy.current = true;
    setPending(true);
    setMutationError(null);
    try {
      await action();
      resource.retry();
      return true;
    } catch (error) {
      if (resource.data?.profileMode === 'access' && needsAuthentication(error)) {
        setSessionExpired(true);
        setSignInRequest(target ?? 'profile');
        resource.retry();
      }
      setMutationError(error instanceof Error ? error.message : 'Salvataggio non riuscito.');
      return false;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  useEffect(() => {
    if (resumed.current || !authenticated || resource.data?.profileMode !== 'access') return;
    const url = new URL(location.href);
    if (url.searchParams.get('resumeFavorite') !== '1') return;
    resumed.current = true;
    let target: AdventureInput | null = null;
    try {
      target = takeFavouriteSignIn(sessionStorage, url.href);
    } catch {
      /* Storage may be unavailable. */
    }
    url.searchParams.delete('resumeFavorite');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    if (target) {
      const selected = target;
      void mutate(() => api.save(selected)).then((saved) => {
        if (!saved) setResumeTarget(selected);
      });
    }
  }, [authenticated, resource.data?.profileMode]);

  const requestSignIn = (item?: CatalogItem) => setSignInRequest(item ?? 'profile');
  return {
    items,
    loading: resource.loading,
    pending,
    canSave: authenticated,
    profileMode: resource.data?.profileMode ?? 'disabled',
    needsSignIn: resource.data?.profileMode === 'access' && !authenticated,
    signInUrl: resource.data?.signInUrl ?? null,
    signInProvider: resource.data?.signInProvider ?? null,
    signOutUrl: resource.data?.signOutUrl ?? null,
    signInRequested: signInRequest !== null,
    signInTarget: signInRequest && signInRequest !== 'profile' ? signInRequest : null,
    requestSignIn,
    closeSignIn: () => setSignInRequest(null),
    beginSignIn: () => {
      if (!resource.data?.signInUrl) return;
      const url = new URL(resource.data.signInUrl, location.origin);
      if (url.origin !== location.origin || url.pathname !== '/api/me/login') return;
      if (signInRequest && signInRequest !== 'profile') {
        const target: AdventureInput = { kind: signInRequest.kind, targetId: signInRequest.id };
        url.searchParams.set('kind', target.kind);
        url.searchParams.set('targetId', String(target.targetId));
        try {
          if (prepareFavouriteSignIn(sessionStorage, target)) url.searchParams.set('resume', '1');
        } catch {
          /* Return to details without auto-saving. */
        }
      }
      location.assign(url.href);
    },
    error: mutationError ?? resource.error,
    retry: () => {
      if (resumeTarget)
        void mutate(() => api.save(resumeTarget)).then((saved) => {
          if (saved) setResumeTarget(null);
        });
      else {
        setMutationError(null);
        resource.retry();
      }
    },
    saved: (item: CatalogItem) => items.find((entry) => entry.item.key === item.key),
    toggle: (item: CatalogItem) => {
      if (!authenticated) {
        requestSignIn(item);
        return Promise.resolve(false);
      }
      const previous = items.find((entry) => entry.item.key === item.key);
      return mutate(
        () =>
          previous ? api.remove(previous.id) : api.save({ kind: item.kind, targetId: item.id }),
        previous ? undefined : item,
      );
    },
    update: (entry: Adventure, changes: AdventureUpdate) =>
      mutate(() => api.update(entry.id, changes)),
    remove: (entry: Adventure) => mutate(() => api.remove(entry.id)),
  };
}
export type AdventuresState = ReturnType<typeof useAdventures>;
