import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fixtureDatabase, fixtureSQL } from './fixtures.js';
import { openDatabase, migrate } from '../src/server/db/connection.js';
import { importCatalog } from '../src/server/import/catalog-importer.js';
import { parseTuples } from '../src/server/import/sql-parser.js';
import { createCatalogRepository } from '../src/server/repositories/catalog-repository.js';
import { createCatalogService, safeURL } from '../src/server/services/catalog-service.js';
import { createAdventureRepository } from '../src/server/repositories/adventure-repository.js';
import { createAdventureService } from '../src/server/services/adventure-service.js';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import * as typedSchema from '../src/server/db/schema.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
test('migration checksums tolerate line-ending conversion but still reject changed SQL', () => {
  const db = fixtureDatabase();
  try {
    const source = readFileSync(
      new URL('../src/server/db/migrations/001_catalog.sql', import.meta.url),
      'utf8',
    ).replace(/\r\n/g, '\n');
    const legacy = createHash('sha256').update(source.replace(/\n/g, '\r\n')).digest('hex');
    db.sqlite
      .prepare('UPDATE schema_migrations SET sha256=? WHERE name=?')
      .run(legacy, '001_catalog.sql');
    migrate(db);
    const current = db.sqlite
      .prepare('SELECT sha256 FROM schema_migrations WHERE name=?')
      .get('001_catalog.sql') as { sha256: string };
    assert.equal(current.sha256, createHash('sha256').update(source).digest('hex'));
    db.sqlite
      .prepare('UPDATE schema_migrations SET sha256=? WHERE name=?')
      .run('modified-schema', '001_catalog.sql');
    assert.throws(() => migrate(db), /Previously applied migration changed/);
  } finally {
    db.sqlite.close();
  }
});
test('typed column mappings remain synchronized with the canonical SQLite migrations', () => {
  const db = fixtureDatabase();
  try {
    for (const table of Object.values(typedSchema)) {
      const config = getTableConfig(table);
      const actual = db.sqlite.pragma(`table_info("${config.name}")`) as { name: string }[];
      assert.deepEqual(
        config.columns.map((c) => c.name).sort(),
        actual.map((c) => c.name).sort(),
        config.name,
      );
    }
  } finally {
    db.sqlite.close();
  }
});
test('dump parser handles escaped text, doubled quotes, BIT booleans, NULL and embedded delimiters', () => {
  assert.deepEqual(parseTuples("(1,'Dent d\\'Herens',b'0',NULL),(2,'L''oro, (neve);',b'1',1.5)"), [
    [1, "Dent d'Herens", 0, null],
    [2, "L'oro, (neve);", 1, 1.5],
  ]);
  assert.throws(() => parseTuples("(1,'broken"));
  assert.deepEqual(parseTuples("(1,'b0',b'0')"), [[1, 'b0', 0]]);
});
test('migrations and import are idempotent and preserve language variants of rock types', () => {
  const db = fixtureDatabase();
  try {
    migrate(db);
    assert.equal(importCatalog(db, fixtureSQL, 'test-fixture', '2017-12-28').unchanged, true);
    assert.equal((db.sqlite.prepare('SELECT count(*) n FROM stone').get() as { n: number }).n, 2);
    assert.equal(
      (db.sqlite.prepare('SELECT count(*) n FROM stone_types').get() as { n: number }).n,
      1,
    );
    assert.deepEqual(db.sqlite.pragma('foreign_key_check'), []);
    assert.equal(db.sqlite.pragma('integrity_check', { simple: true }), 'ok');
  } finally {
    db.sqlite.close();
  }
});
test('an invalid reference rolls back the complete import', () => {
  const db = openDatabase(':memory:');
  migrate(db);
  try {
    assert.throws(() =>
      importCatalog(
        db,
        fixtureSQL.replace("4478,1,b'1',1", "4478,999,b'1',1"),
        'bad-fixture',
        '2017-12-28',
      ),
    );
    assert.equal(
      (db.sqlite.prepare('SELECT count(*) n FROM mountain').get() as { n: number }).n,
      0,
    );
    assert.equal(
      (db.sqlite.prepare('SELECT count(*) n FROM import_batches').get() as { n: number }).n,
      0,
    );
  } finally {
    db.sqlite.close();
  }
});
test('private identity and catalog author columns are absent from the MVP database', () => {
  const db = fixtureDatabase();
  try {
    assert.equal(
      db.sqlite.prepare("SELECT name FROM sqlite_master WHERE name='aspnetusers'").get(),
      undefined,
    );
    assert.ok(
      !(db.sqlite.pragma('table_info(route)') as { name: string }[]).some(
        (c) => c.name === 'user_id',
      ),
    );
  } finally {
    db.sqlite.close();
  }
});
test('normalization keeps absent coordinates and measurements unknown and audits originals', async () => {
  const db = fixtureDatabase();
  try {
    const service = createCatalogService(createCatalogRepository(db));
    const peak = (await service.detail('mountain', 11))!;
    assert.equal(peak.latitude, null);
    assert.equal(peak.longitude, null);
    const route = (await service.detail('route', 1))!;
    assert.equal(route.mountainId, null);
    assert.equal(route.lengthM, null);
    assert.equal(route.latitude, null);
    assert.equal(route.difficultyRaw, 'EE,I,F');
    assert.ok(
      (db.sqlite.prepare('SELECT count(*) n FROM import_issues').get() as { n: number }).n >= 3,
    );
  } finally {
    db.sqlite.close();
  }
});
test('queries filter active records, normalize accents, combine filters and clamp pagination', async () => {
  const db = fixtureDatabase();
  try {
    const r = createCatalogRepository(db);
    assert.equal((await r.stats()).mountains, 2);
    assert.equal((await r.stats()).routes, 2);
    assert.equal((await r.list({ q: 'Tasch' })).items[0].id, 11);
    assert.equal((await r.list({ q: 'Cervino Pennine' })).items[0].id, 10);
    assert.equal(
      (await r.list({ kind: 'route', activityId: 7, countryId: 1, regionId: 1 })).total,
      1,
    );
    assert.equal((await r.list({ kind: 'mountain', minElevation: 4480 })).total, 1);
    assert.equal((await r.list({ page: 100, pageSize: 2 })).page, 2);
    assert.equal((await r.list({ q: "' OR 1=1; --" })).total, 0);
    assert.equal(await r.get('mountain', 12), null);
  } finally {
    db.sqlite.close();
  }
});
test('sources resolve relative paths safely and route maps distinguish the mountain', async () => {
  const db = fixtureDatabase();
  try {
    const service = createCatalogService(createCatalogRepository(db));
    assert.equal(
      (await service.detail('route', 1))!.sources[0].url,
      'https://example.org/report.html',
    );
    const route = (await service.detail('route', 2))!;
    assert.equal(route.latitude, null);
    assert.deepEqual(route.mountainLocation, { latitude: 45.9764, longitude: 7.65833 });
    assert.equal(safeURL('javascript:alert(1)'), null);
    assert.equal(safeURL('https://user:secret@example.org'), null);
  } finally {
    db.sqlite.close();
  }
});
test('adventures are unique, enforce one target, persist across reopening, and update completion and notes', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'sym-mvp-'));
  const filename = path.join(dir, 'test.sqlite');
  let db = fixtureDatabase(filename);
  try {
    const service = createAdventureService(
      createAdventureRepository(db),
      createCatalogRepository(db),
    );
    const first = await service.create({ kind: 'mountain', targetId: 10 });
    assert.equal((await service.create({ kind: 'mountain', targetId: 10 })).id, first.id);
    await assert.rejects(() => service.create({ kind: 'mountain', targetId: 12 }));
    assert.throws(() =>
      db.sqlite
        .prepare("INSERT INTO adventures VALUES ('bad','local',10,1,'planned',NULL,'','now','now')")
        .run(),
    );
    await service.update(first.id, { status: 'completed', notes: 'Portare acqua' });
    db.sqlite.close();
    db = openDatabase(filename);
    migrate(db);
    const reopened = createAdventureService(
      createAdventureRepository(db),
      createCatalogRepository(db),
    );
    assert.equal((await reopened.list())[0].status, 'completed');
    assert.equal((await reopened.list())[0].notes, 'Portare acqua');
    assert.ok((await reopened.list())[0].completedAt);
    await reopened.update(first.id, { status: 'planned' });
    assert.equal((await reopened.list())[0].completedAt, null);
    await reopened.remove(first.id);
    assert.equal((await reopened.list()).length, 0);
  } finally {
    db.sqlite.close();
    await rm(dir, { recursive: true, force: true });
  }
});
