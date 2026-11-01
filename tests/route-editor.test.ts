import { readFileSync } from 'node:fs';
import { createWorker } from '../src/worker/index.js';
import type { WorkerEnv } from '../src/worker/bindings.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fixtureDatabase } from './fixtures.js';
import { createRouteEditor } from '../src/core/route-editor.js';
import { sqliteQueries } from '../src/server/db/query-adapter.js';
import { createCatalogRepository } from '../src/server/repositories/catalog-repository.js';
import { createApp, errorHandler } from '../src/server/http/app.js';

test('route editor preserves omitted values, updates search atomically and rejects stale or invalid edits', async () => {
  const db = fixtureDatabase(),
    editor = createRouteEditor(sqliteQueries(db));
  try {
    const original = await editor.get(2);
    await assert.rejects(() => editor.patch(2, { title: 'New' }, null), { status: 428 });
    await assert.rejects(() => editor.patch(2, { title: 'New' }, '"stale"'), { status: 412 });
    await assert.rejects(() => editor.patch(2, { id: 99 }, original.etag));
    await assert.rejects(() => editor.patch(2, {}, original.etag));
    await assert.rejects(() => editor.patch(2, { latitude: 45 }, original.etag), { status: 400 });
    await assert.rejects(() => editor.patch(2, { activityId: 999 }, original.etag), {
      status: 400,
    });
    const edited = await editor.patch(
      2,
      { title: 'Nuova cresta test', difficultyRaw: 'AD+', lengthM: 0, latitude: 45, longitude: 8 },
      original.etag,
    );
    assert.notEqual(edited.etag, original.etag);
    assert.equal(edited.route.lengthM, 0);
    assert.equal(edited.route.activityId, original.route.activityId);
    const catalog = createCatalogRepository(db);
    assert.deepEqual(
      (await catalog.suggestions({ q: 'Nuova cresta', kind: 'route' })).items.map((x) => x.id),
      [2],
    );
    assert.equal((await catalog.get('route', 2))?.name, 'Nuova cresta test');
    await assert.rejects(() => editor.patch(2, { title: 'Lost change' }, original.etag), {
      status: 412,
    });
    await assert.rejects(() => editor.get(3), { status: 404 });
    await assert.rejects(() => editor.get(999), { status: 404 });
    const titleless = await editor.get(1);
    assert.equal((await editor.patch(1, { heightM: 50 }, titleless.etag)).route.heightM, 50);
    db.sqlite.prepare("DELETE FROM catalog_search_keys WHERE entity_key='r-2'").run();
    await assert.rejects(() => editor.patch(2, { title: 'Must roll back' }, edited.etag));
    assert.equal((await editor.get(2)).route.title, 'Nuova cresta test');
  } finally {
    db.sqlite.close();
  }
});

test('compare-and-update detects edits made between the read and the write', async () => {
  const db = fixtureDatabase(),
    port = sqliteQueries(db),
    original = await createRouteEditor(port).get(2);
  try {
    const racing = {
      prepare(sql: string) {
        const statement = port.prepare(sql);
        return {
          ...statement,
          get: async (...args: Parameters<typeof statement.get>) => {
            if (sql.startsWith('UPDATE route SET'))
              db.sqlite.prepare("UPDATE route SET route_title='Other editor' WHERE id=2").run();
            return statement.get(...args);
          },
        };
      },
    };
    await assert.rejects(
      () => createRouteEditor(racing).patch(2, { title: 'Overwrite' }, original.etag),
      { status: 412 },
    );
    assert.equal((await createRouteEditor(port).get(2)).route.title, 'Other editor');
  } finally {
    db.sqlite.close();
  }
});

test('local editor API uses ETags, validates JSON and rejects cross-origin writes', async () => {
  const db = fixtureDatabase(),
    app = createApp(db);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
  try {
    const response = await fetch(base + '/api/editor/routes/2');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const tag = response.headers.get('ETag')!;
    const patch = (body: unknown, origin = base, etag = tag) =>
      fetch(base + '/api/editor/routes/2', {
        method: 'PATCH',
        headers: { Origin: origin, 'Content-Type': 'application/json', 'If-Match': etag },
        body: JSON.stringify(body),
      });
    assert.equal((await patch({ title: 'Blocked' }, 'https://evil.test')).status, 403);
    assert.equal((await patch({ route_status: 0 })).status, 400);
    const edit = await patch({ title: 'Edited via API' });
    assert.equal(edit.status, 200);
    assert.notEqual(edit.headers.get('ETag'), tag);
    assert.equal((await patch({ title: 'Stale' })).status, 412);
    assert.equal((await fetch(base + '/api/editor/routes/999')).status, 404);
    assert.equal(
      (
        await fetch(base + '/api/routes/2', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
      ).status,
      404,
    );
  } finally {
    server.close();
    db.sqlite.close();
  }
});

test('search migration upgrades a populated catalog without reimporting records', async () => {
  const db = fixtureDatabase();
  try {
    db.sqlite.exec('DROP TRIGGER route_edit_search; DROP TABLE catalog_search_keys;');
    const sql = readFileSync(
      new URL('../d1/migrations/0005_route_edit_search.sql', import.meta.url),
      'utf8',
    );
    assert.equal(
      sql,
      readFileSync(
        new URL('../src/server/db/migrations/004_route_edit_search.sql', import.meta.url),
        'utf8',
      ),
    );
    db.sqlite.transaction(() => db.sqlite.exec(sql))();
    const editor = createRouteEditor(sqliteQueries(db)),
      before = await editor.get(2);
    await editor.patch(2, { title: 'Upgraded catalog' }, before.etag);
    assert.equal(
      (await createCatalogRepository(db).suggestions({ q: 'Upgraded', kind: 'route' })).items[0].id,
      2,
    );
  } finally {
    db.sqlite.close();
  }
});

test('online editing stays disabled without a separate editor audience', async () => {
  for (const audience of [undefined, 'viewer-audience']) {
    const env: WorkerEnv = {
      DB: {} as WorkerEnv['DB'],
      ASSETS: { fetch: async () => new Response('') },
      ACCESS_TEAM_DOMAIN: 'fixture.cloudflareaccess.com',
      ACCESS_AUD: 'viewer-audience',
      ACCESS_EDITOR_AUD: audience,
    };
    const response = await createWorker().fetch(
      new Request('https://example.test/api/editor/routes/2'),
      env,
    );
    assert.equal(response.status, 503);
  }
});
