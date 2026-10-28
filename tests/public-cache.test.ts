import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicCache } from '../src/worker/public-cache.js';
import { isD1QuotaError, quotaResponse } from '../src/worker/quota-error.js';
import { createWorker } from '../src/worker/index.js';
import type { WorkerEnv } from '../src/worker/bindings.js';

const request = (path: string, method = 'GET') =>
  new Request('https://example.test' + path, { method });
const json = (value: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });

test('public cache coalesces concurrent requests, isolates queries/databases and expires entries', async () => {
  let now = 0,
    calls = 0;
  const cached = createPublicCache(
      () => undefined,
      () => now,
    ),
    database = {};
  const load = async () => json({ calls: ++calls });
  const pair = await Promise.all([
    cached(request('/api/stats'), database, load),
    cached(request('/api/stats'), database, load),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(await pair[0].json(), await pair[1].json());
  assert.match(pair[0].headers.get('Cache-Control')!, /public/);
  await cached(request('/api/stats'), database, load);
  assert.equal(calls, 1);
  await cached(request('/api/stats'), {}, load);
  assert.equal(calls, 2);
  await cached(request('/api/catalog?q=first'), database, load);
  await cached(request('/api/catalog?q=second'), database, load);
  assert.equal(calls, 4);
  await cached(request('/api/catalog?q=first&__sym_catalog_cache=evil'), database, load);
  assert.equal(calls, 5);
  now = 3_600_001;
  await cached(request('/api/stats'), database, load);
  assert.equal(calls, 6);
});

test('personal data, mutations, cookies, redirects and errors are never cached', async () => {
  const cached = createPublicCache(() => undefined),
    database = {};
  for (const [path, method, status, headers] of [
    ['/api/me/adventures', 'GET', 200, {}],
    ['/api/capabilities', 'GET', 200, {}],
    ['/api/health', 'GET', 200, {}],
    ['/api/catalog', 'POST', 200, {}],
    ['/api/stats', 'GET', 503, {}],
    ['/api/stats', 'GET', 302, { Location: '/login' }],
    ['/api/stats', 'GET', 200, { 'Set-Cookie': 'private=value' }],
  ] as [string, string, number, Record<string, string>][]) {
    let calls = 0;
    const load = async () => json({ calls: ++calls }, status, headers);
    await cached(request(path, method), database, load);
    await cached(request(path, method), database, load);
    assert.equal(calls, 2, `${method} ${path} ${status} was cached`);
  }
});

test('edge cache failures fall back without breaking public responses', async () => {
  const cached = createPublicCache(() => ({
    match: async () => {
      throw Error('unavailable');
    },
    put: async () => {
      throw Error('unavailable');
    },
  }));
  assert.equal(
    (await cached(request('/api/filters'), {}, async () => json({ ok: true }))).status,
    200,
  );
});

test('quota errors return a safe retry time instead of a migration error', async () => {
  const error = new Error('D1_ERROR', {
    cause: new Error(
      "Your account has exceeded D1's free tier daily row read limit. Account: do-not-expose",
    ),
  });
  assert.equal(isD1QuotaError(error), true);
  assert.equal(isD1QuotaError(new Error('no such table: mountain')), false);
  const response = quotaResponse(Date.parse('2026-10-27T23:30:00Z'));
  assert.equal(response.headers.get('Retry-After'), '1800');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const payload = await response.json();
  assert.equal(payload.code, 'D1_DAILY_LIMIT');
  assert.equal(payload.retryAt, '2026-10-28T00:00:00.000Z');
  assert.ok(!JSON.stringify(payload).includes('do-not-expose'));
  const env = {
    DB: {
      prepare() {
        throw error;
      },
    },
  } as unknown as WorkerEnv;
  const result = await createWorker().fetch(request('/api/health'), env);
  assert.equal(result.status, 503);
  assert.equal((await result.json()).code, 'D1_DAILY_LIMIT');
});
