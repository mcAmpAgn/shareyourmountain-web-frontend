type Store = Pick<Cache, 'match' | 'put'>;
type Entry = { response: Response; expires: number; bytes: number };

export function catalogTTL(request: Request): number {
  if (request.method !== 'GET') return 0;
  const path = new URL(request.url).pathname;
  if (['/api/stats', '/api/filters'].includes(path)) return 3600;
  if (path === '/api/suggestions') return 60;
  if (path === '/api/map/mountains') return 120;
  if (
    ['/api/catalog', '/api/mountains', '/api/routes'].includes(path) ||
    /^\/api\/(mountains|routes)\/\d+$/.test(path)
  )
    return 300;
  return 0;
}

function edgeStore(): Store | undefined {
  try {
    return (globalThis.caches as CacheStorage & { default?: Cache })?.default;
  } catch {
    return undefined;
  }
}

/** Public DTOs only. Never store identities, personal APIs, failed responses or redirects. */
export function createPublicCache(
  store: () => Store | undefined = edgeStore,
  now = () => Date.now(),
) {
  const pools = new WeakMap<
    object,
    { entries: Map<string, Entry>; pending: Map<string, Promise<Response>>; bytes: number }
  >();
  return async function cached(request: Request, database: object, load: () => Promise<Response>) {
    const ttl = catalogTTL(request);
    if (!ttl) return load();
    const pool = pools.get(database) ?? {
      entries: new Map<string, Entry>(),
      pending: new Map<string, Promise<Response>>(),
      bytes: 0,
    };
    if (!pools.has(database)) pools.set(database, pool);
    const cacheURL = new URL(request.url);
    cacheURL.searchParams.sort();
    cacheURL.pathname = '/__sym_catalog_cache/v2' + cacheURL.pathname;
    const key = cacheURL.href;
    const entry = pool.entries.get(key);
    if (entry && entry.expires > now()) {
      pool.entries.delete(key);
      pool.entries.set(key, entry);
      return entry.response.clone();
    }
    if (entry) {
      pool.entries.delete(key);
      pool.bytes -= entry.bytes;
    }
    if (pool.pending.has(key)) return (await pool.pending.get(key)!).clone();
    const task = (async () => {
      const edge = store();
      const cacheRequest = new Request(key);
      if (edge) {
        try {
          const hit = await edge.match(cacheRequest);
          if (hit) return hit;
        } catch {
          /* Cache availability never blocks the catalog. */
        }
      }
      const response = await load();
      if (
        response.status !== 200 ||
        response.headers.has('Set-Cookie') ||
        !response.headers.get('Content-Type')?.includes('application/json')
      )
        return response;
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', `public, max-age=${Math.min(ttl, 60)}, s-maxage=${ttl}`);
      const body = await response.arrayBuffer();
      const output = new Response(body, { status: 200, headers });
      if (body.byteLength <= 512 * 1024) {
        while (pool.entries.size >= 64 || pool.bytes + body.byteLength > 8 * 1024 * 1024) {
          const oldest = pool.entries.keys().next().value;
          if (!oldest) break;
          pool.bytes -= pool.entries.get(oldest)!.bytes;
          pool.entries.delete(oldest);
        }
        pool.entries.set(key, {
          response: output.clone(),
          expires: now() + ttl * 1000,
          bytes: body.byteLength,
        });
        pool.bytes += body.byteLength;
      }
      if (edge) {
        try {
          await edge.put(cacheRequest, output.clone());
        } catch {
          /* Fall back to bounded isolate memory. */
        }
      }
      return output;
    })();
    pool.pending.set(key, task);
    try {
      return (await task).clone();
    } finally {
      pool.pending.delete(key);
    }
  };
}
