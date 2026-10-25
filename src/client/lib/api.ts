import type {
  Adventure,
  AdventureInput,
  AdventureUpdate,
  CatalogDetail,
  CatalogPage,
  CatalogQuery,
  Filters,
  Stats,
  ItemKind,
} from '../../shared/contracts';
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch('/api' + path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.error ?? 'Il servizio non è disponibile. Riprova.', response.status);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const queryString = (query: CatalogQuery) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== '') params.set(key, String(value));
  return params.toString();
};
export const api = {
  stats: (signal?: AbortSignal) => request<Stats>('/stats', { signal }),
  filters: (signal?: AbortSignal) => request<Filters>('/filters', { signal }),
  catalog: (query: CatalogQuery, signal?: AbortSignal) =>
    request<CatalogPage>('/catalog?' + queryString(query), { signal }),
  detail: (kind: ItemKind, id: number, signal?: AbortSignal) =>
    request<CatalogDetail>(`/${kind === 'mountain' ? 'mountains' : 'routes'}/${id}`, { signal }),
  adventures: (signal?: AbortSignal) => request<Adventure[]>('/me/adventures', { signal }),
  save: (input: AdventureInput) =>
    request<Adventure>('/me/adventures', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, changes: AdventureUpdate) =>
    request<Adventure>('/me/adventures/' + id, { method: 'PATCH', body: JSON.stringify(changes) }),
  remove: (id: string) => request<void>('/me/adventures/' + id, { method: 'DELETE' }),
};
