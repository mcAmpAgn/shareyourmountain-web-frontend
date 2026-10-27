import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fixtureDatabase } from './fixtures.js';
import { createApp, errorHandler } from '../src/server/http/app.js';
test('API validates queries, serves public DTOs, protects the local profile and persists CRUD', async () => {
  const db = fixtureDatabase(),
    app = createApp(db);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const json = (method: string, body: unknown, origin = base) => ({
    method,
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  try {
    assert.equal((await fetch(base + '/api/health').then((r) => r.json())).initialized, true);
    assert.equal(
      (await fetch(base + '/api/catalog?kind=route&activityId=7').then((r) => r.json())).total,
      1,
    );
    assert.equal((await fetch(base + '/api/catalog?page=-1')).status, 400);
    assert.equal((await fetch(base + '/api/catalog?pageSize=999')).status, 400);
    assert.equal((await fetch(base + '/api/catalog?unknown=1')).status, 400);
    assert.equal((await fetch(base + '/api/routes/nope')).status, 400);
    assert.equal((await fetch(base + '/api/routes/999')).status, 404);
    const suggestions = await fetch(base + '/api/suggestions?q=Cerv').then((r) => r.json());
    assert.deepEqual(
      suggestions.items.map((item: { key: string }) => item.key),
      ['m-10', 'r-2'],
    );
    assert.equal(
      (await fetch(base + '/api/suggestions?q=Tasch').then((r) => r.json())).items[0].key,
      'm-11',
    );
    assert.equal(
      (await fetch(base + '/api/suggestions?q=Cerv&kind=route&activityId=7').then((r) => r.json()))
        .items[0].key,
      'r-2',
    );
    assert.equal(
      (await fetch(base + '/api/suggestions?q=Pennine').then((r) => r.json())).items.length,
      0,
    );
    assert.equal((await fetch(base + '/api/suggestions?q=C')).status, 400);
    assert.equal((await fetch(base + '/api/suggestions?q=Cerv&pageSize=99')).status, 400);
    assert.equal((await fetch(base + '/api/mountains/10').then((r) => r.json())).key, 'm-10');
    assert.equal(
      (await fetch(base + '/api/map/mountains?bbox=6,45,8,47').then((r) => r.json())).items.length,
      1,
    );
    assert.equal((await fetch(base + '/api/map/mountains?bbox=200,0,300,1')).status, 400);
    assert.equal(
      (
        await fetch(
          base + '/api/me/adventures',
          json('POST', { kind: 'mountain', targetId: 10 }, 'https://evil.example'),
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(
          base + '/api/me/adventures',
          json('POST', { kind: 'mountain', targetId: 10, profileId: 'other' }),
        )
      ).status,
      400,
    );
    const saved = await fetch(
      base + '/api/me/adventures',
      json('POST', { kind: 'mountain', targetId: 10 }),
    ).then((r) => r.json());
    assert.ok(saved.id);
    assert.equal(
      (
        await fetch(
          base + '/api/me/adventures/' + saved.id,
          json('PATCH', { status: 'completed', notes: 'Una bella meta' }),
        ).then((r) => r.json())
      ).status,
      'completed',
    );
    assert.equal((await fetch(base + '/api/me/adventures').then((r) => r.json())).length, 1);
    assert.equal(
      (
        await fetch(
          base + '/api/me/adventures/' + saved.id,
          json('PATCH', { notes: 'x'.repeat(2001) }),
        )
      ).status,
      400,
    );
    assert.equal(
      (await fetch(base + '/api/me/adventures/' + saved.id, json('DELETE', undefined))).status,
      204,
    );
    assert.equal((await fetch(base + '/api/me/adventures').then((r) => r.json())).length, 0);
    assert.equal((await fetch(base + '/api/does-not-exist')).status, 404);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    db.sqlite.close();
  }
});
