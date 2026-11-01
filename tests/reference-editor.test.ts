import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { fixtureDatabase } from './fixtures.js';
import { createReferenceEditor } from '../src/core/reference-editor.js';
import { sqliteQueries } from '../src/server/db/query-adapter.js';
import { createApp, errorHandler } from '../src/server/http/app.js';
import { createWorker } from '../src/worker/index.js';
import type { WorkerEnv } from '../src/worker/bindings.js';

test('source and route references preserve fields, validate URLs and enforce versions and ownership', async () => {
  const db = fixtureDatabase(),
    editor = createReferenceEditor(sqliteQueries(db));
  try {
    const source = await editor.createSource({ name: 'Test source', url: 'https://test.example/' });
    assert.equal(source.record.logo, null);
    await assert.rejects(
      () => editor.createSource({ name: 'Duplicate', url: 'https://test.example' }),
      { status: 409 },
    );
    for (const url of [
      'javascript:alert(1)',
      'https://user:secret@example.org',
      '/relative',
      'data:text/html,no',
    ]) {
      await assert.rejects(() => editor.createSource({ name: 'Invalid', url }));
      await assert.rejects(() => editor.createWebinfo(2, { url }));
    }
    await assert.rejects(() => editor.patchSource(source.record.id, { name: 'No version' }, null), {
      status: 428,
    });
    const edited = await editor.patchSource(source.record.id, { name: 'Renamed' }, source.etag);
    assert.equal(edited.record.url, source.record.url);
    await assert.rejects(
      () => editor.patchSource(source.record.id, { name: 'Stale' }, source.etag),
      { status: 412 },
    );
    await assert.rejects(() => editor.patchSource(source.record.id, {}, edited.etag));
    await assert.rejects(() =>
      editor.patchSource(source.record.id, { source_dateIns: 'no' }, edited.etag),
    );
    const web = await editor.createWebinfo(2, {
      sourceId: source.record.id,
      url: 'https://test.example/route',
      summary: 'Reference',
      languageCode: 'it',
    });
    assert.equal(web.record.routeId, 2);
    await assert.rejects(() => editor.createWebinfo(2, { url: web.record.url }), { status: 409 });
    await assert.rejects(() => editor.createWebinfo(999, { url: web.record.url }), { status: 404 });
    await assert.rejects(() => editor.createWebinfo(3, { url: web.record.url }), { status: 404 });
    await assert.rejects(
      () => editor.createWebinfo(2, { sourceId: 999, url: 'https://test.example/other' }),
      { status: 400 },
    );
    await assert.rejects(() => editor.getWebinfo(1, web.record.id), { status: 404 });
    const amended = await editor.patchWebinfo(
      2,
      web.record.id,
      { summary: null, rate: '5c' },
      web.etag,
    );
    assert.equal(amended.record.summary, null);
    assert.equal(amended.record.sourceId, source.record.id);
    assert.equal(amended.record.url, web.record.url);
    await assert.rejects(() => editor.patchWebinfo(2, web.record.id, { rate: '6a' }, web.etag), {
      status: 412,
    });
    const legacy = await editor.getWebinfo(1, 1);
    await assert.rejects(
      () => editor.patchWebinfo(1, 1, { sourceId: source.record.id }, legacy.etag),
      { status: 400 },
    );
    assert.equal(
      (await editor.patchWebinfo(1, 1, { summary: 'Legacy URL preserved' }, legacy.etag)).record
        .url,
      'report.html',
    );
    assert.equal((await editor.sources('Rename', 0)).items[0].id, source.record.id);
    assert.equal((await editor.sources('%', 0)).items.length, 0);
    assert.equal((await editor.webinfo(2, 0)).items.length, 1);
  } finally {
    db.sqlite.close();
  }
});

test('reference updates detect a writer racing between the read and write', async () => {
  const db = fixtureDatabase(),
    port = sqliteQueries(db),
    editor = createReferenceEditor(port);
  try {
    const before = await editor.getSource(1);
    const racing = {
      prepare(sql: string) {
        const statement = port.prepare(sql);
        return {
          ...statement,
          get: async (...args: Parameters<typeof statement.get>) => {
            if (sql.startsWith('UPDATE source SET'))
              db.sqlite.prepare("UPDATE source SET source_name='Concurrent edit' WHERE id=1").run();
            return statement.get(...args);
          },
        };
      },
    };
    await assert.rejects(
      () => createReferenceEditor(racing).patchSource(1, { name: 'Overwrite' }, before.etag),
      { status: 412 },
    );
    assert.equal((await editor.getSource(1)).record.name, 'Concurrent edit');
  } finally {
    db.sqlite.close();
  }
});

test('reference HTTP endpoints validate writes, route scope, origin and ETags', async () => {
  const db = fixtureDatabase(),
    app = createApp(db);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
  const call = (
    path: string,
    method = 'GET',
    body?: unknown,
    tag = '',
    origin = base,
    contentType = 'application/json',
  ) =>
    fetch(base + '/api/editor' + path, {
      method,
      headers: { Origin: origin, 'Content-Type': contentType, 'If-Match': tag },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    assert.equal(
      (await call('/sources', 'POST', { name: 'Bad origin' }, '', 'https://evil.test')).status,
      403,
    );
    assert.equal(
      (await call('/sources', 'POST', { name: 'Wrong type' }, '', base, 'text/plain')).status,
      415,
    );
    const created = await call('/sources', 'POST', {
      name: 'API source',
      url: 'https://api.example',
    });
    assert.equal(created.status, 201);
    assert.equal(created.headers.get('Cache-Control'), 'no-store');
    const source = (await created.json()) as { id: number };
    const path = '/sources/' + source.id;
    assert.equal((await call(path, 'PATCH', { name: 'Missing version' })).status, 428);
    assert.equal(
      (await call(path, 'PATCH', { name: 'API source edited' }, created.headers.get('ETag')!))
        .status,
      200,
    );
    assert.equal(
      (await call(path, 'PATCH', { name: 'Stale' }, created.headers.get('ETag')!)).status,
      412,
    );
    assert.equal((await call('/sources?after=-1')).status, 400);
    assert.equal((await call('/sources/invalid')).status, 400);
    assert.equal((await call('/sources/999')).status, 404);
    assert.equal((await call('/sources', 'DELETE')).status, 405);
    const web = await call('/routes/2/webinfo', 'POST', {
      sourceId: source.id,
      url: 'https://api.example/route',
      summary: 'API reference',
    });
    assert.equal(web.status, 201);
    const item = (await web.json()) as { id: number };
    assert.equal((await call('/routes/1/webinfo/' + item.id)).status, 404);
    assert.equal(
      (
        await call(
          '/routes/2/webinfo/' + item.id,
          'PATCH',
          { summary: 'Updated via HTTP' },
          web.headers.get('ETag')!,
        )
      ).status,
      200,
    );
    const links = (await fetch(base + '/api/routes/2').then((r) => r.json())) as {
      sources: { name: string; url: string }[];
    };
    assert.equal(links.sources[0].url, 'https://api.example/route');
    assert.equal(links.sources[0].name, 'API source edited');
    assert.equal(
      (await call('/routes/2/webinfo', 'POST', { sourceId: 999, url: 'https://bad.example/' }))
        .status,
      400,
    );
  } finally {
    server.close();
    db.sqlite.close();
  }
});

test('reference lists are bounded with a continuation cursor', async () => {
  const db = fixtureDatabase(),
    editor = createReferenceEditor(sqliteQueries(db));
  try {
    for (let i = 0; i < 55; i++)
      db.sqlite.prepare('INSERT INTO source(source_name) VALUES (?)').run('Paged ' + i);
    const first = await editor.sources('Paged', 0),
      second = await editor.sources('Paged', first.nextAfter!);
    assert.equal(first.items.length, 50);
    assert.equal(second.items.length, 5);
    assert.equal(second.nextAfter, null);
    assert.equal(new Set([...first.items, ...second.items].map((x) => x.id)).size, 55);
    assert.equal(
      readFileSync('d1/migrations/0006_reference_editor.sql', 'utf8'),
      readFileSync('src/server/db/migrations/005_reference_editor.sql', 'utf8'),
    );
  } finally {
    db.sqlite.close();
  }
});

test('new Worker reference endpoints fail closed before accessing D1', async () => {
  for (const path of ['/sources', '/sources/1', '/routes/2/webinfo', '/routes/2/webinfo/1']) {
    for (const aud of [undefined, 'viewer']) {
      const env: WorkerEnv = {
        DB: {} as WorkerEnv['DB'],
        ASSETS: { fetch: async () => new Response('') },
        ACCESS_AUD: 'viewer',
        ACCESS_EDITOR_AUD: aud,
      };
      assert.equal(
        (await createWorker().fetch(new Request('https://example.test/api/editor' + path), env))
          .status,
        503,
      );
    }
  }
});
