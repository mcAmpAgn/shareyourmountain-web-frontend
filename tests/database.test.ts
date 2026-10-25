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
test('normalization keeps absent coordinates and measurements unknown and audits originals', () => {
  const db = fixtureDatabase();
  try {
    const service = createCatalogService(createCatalogRepository(db));
    const peak = service.detail('mountain', 11)!;
    assert.equal(peak.latitude, null);
    assert.equal(peak.longitude, null);
    const route = service.detail('route', 1)!;
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
test('queries filter active records, normalize accents, combine filters and clamp pagination', () => {
  const db = fixtureDatabase();
  try {
    const r = createCatalogRepository(db);
    assert.equal(r.stats().mountains, 2);
    assert.equal(r.stats().routes, 2);
    assert.equal(r.list({ q: 'Tasch' }).items[0].id, 11);
    assert.equal(r.list({ q: 'Cervino Pennine' }).items[0].id, 10);
    assert.equal(r.list({ kind: 'route', activityId: 7, countryId: 1, regionId: 1 }).total, 1);
    assert.equal(r.list({ kind: 'mountain', minElevation: 4480 }).total, 1);
    assert.equal(r.list({ page: 100, pageSize: 2 }).page, 2);
    assert.equal(r.list({ q: "' OR 1=1; --" }).total, 0);
    assert.equal(r.get('mountain', 12), null);
  } finally {
    db.sqlite.close();
  }
});
test('sources resolve relative paths safely and route maps distinguish the mountain', () => {
  const db = fixtureDatabase();
  try {
    const service = createCatalogService(createCatalogRepository(db));
    assert.equal(service.detail('route', 1)!.sources[0].url, 'https://example.org/report.html');
    const route = service.detail('route', 2)!;
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
    const first = service.create({ kind: 'mountain', targetId: 10 });
    assert.equal(service.create({ kind: 'mountain', targetId: 10 }).id, first.id);
    assert.throws(() => service.create({ kind: 'mountain', targetId: 12 }));
    assert.throws(() =>
      db.sqlite
        .prepare("INSERT INTO adventures VALUES ('bad','local',10,1,'planned',NULL,'','now','now')")
        .run(),
    );
    service.update(first.id, { status: 'completed', notes: 'Portare acqua' });
    db.sqlite.close();
    db = openDatabase(filename);
    migrate(db);
    const reopened = createAdventureService(
      createAdventureRepository(db),
      createCatalogRepository(db),
    );
    assert.equal(reopened.list()[0].status, 'completed');
    assert.equal(reopened.list()[0].notes, 'Portare acqua');
    assert.ok(reopened.list()[0].completedAt);
    reopened.update(first.id, { status: 'planned' });
    assert.equal(reopened.list()[0].completedAt, null);
    reopened.remove(first.id);
    assert.equal(reopened.list().length, 0);
  } finally {
    db.sqlite.close();
    await rm(dir, { recursive: true, force: true });
  }
});
