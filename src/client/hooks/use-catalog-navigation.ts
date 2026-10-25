import { useEffect, useState } from 'react';
import type { CatalogItem, CatalogQuery, ItemKind } from '../../shared/contracts';
import { queryString } from '../lib/api';
function readQuery(): CatalogQuery {
  const params = new URLSearchParams(location.search),
    query: CatalogQuery = {};
  if (params.get('q')) query.q = params.get('q')!.slice(0, 120);
  if (['mountain', 'route'].includes(params.get('kind') ?? ''))
    query.kind = params.get('kind') as ItemKind;
  for (const key of [
    'activityId',
    'rangeId',
    'countryId',
    'regionId',
    'mountainId',
    'minElevation',
    'page',
  ] as const) {
    const value = Number(params.get(key));
    const maximum = key === 'page' ? 100000 : key === 'minElevation' ? 9000 : 2147483647;
    if (params.has(key) && Number.isInteger(value) && value > 0 && value <= maximum)
      query[key] = value;
  }
  if (params.get('sort') === 'elevation') query.sort = 'elevation';
  return query;
}
function readDetail() {
  const match = location.hash.match(/^#detail=([mr])-(\d+)$/);
  if (!match || Number(match[2]) > 2147483647) return null;
  return { kind: (match[1] === 'm' ? 'mountain' : 'route') as ItemKind, id: Number(match[2]) };
}
export function useCatalogNavigation() {
  const [query, setQuery] = useState<CatalogQuery>(readQuery),
    [featured, setFeatured] = useState(() => !location.search),
    [detail, setDetail] = useState(readDetail);
  useEffect(() => {
    const params = queryString(query);
    history.replaceState(
      null,
      '',
      location.pathname + (params ? '?' + params : '') + location.hash,
    );
  }, [query]);
  useEffect(() => {
    const hash = () => setDetail(readDetail());
    const back = () => {
      setQuery(readQuery());
      setFeatured(!location.search);
      setDetail(readDetail());
    };
    window.addEventListener('hashchange', hash);
    window.addEventListener('popstate', back);
    return () => {
      window.removeEventListener('hashchange', hash);
      window.removeEventListener('popstate', back);
    };
  }, []);
  return {
    query,
    featured,
    detail,
    open(item: Pick<CatalogItem, 'kind' | 'id'>) {
      setDetail(item);
      history.replaceState(
        null,
        '',
        location.pathname +
          location.search +
          `#detail=${item.kind === 'mountain' ? 'm' : 'r'}-${item.id}`,
      );
    },
    closeDetail() {
      setDetail(null);
      if (location.hash.startsWith('#detail='))
        history.replaceState(null, '', location.pathname + location.search);
    },
    change(patch: Partial<CatalogQuery>) {
      setFeatured(false);
      setQuery((previous) => ({ ...previous, ...patch, page: patch.page ?? 1 }));
      if (patch.page) document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' });
    },
    reset() {
      setFeatured(false);
      setQuery({});
    },
    inspire() {
      setQuery({});
      setFeatured(true);
    },
    search(q: string, activity: string) {
      setFeatured(false);
      setQuery({
        q: q || undefined,
        kind: activity === 'mountain' ? 'mountain' : activity ? 'route' : undefined,
        activityId: activity && activity !== 'mountain' ? Number(activity) : undefined,
      });
      document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' });
    },
  };
}
