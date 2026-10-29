import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixtureDatabase } from './fixtures.js';
import { createCatalogRepository } from '../src/server/repositories/catalog-repository.js';
import { sqlStatements } from '../scripts/sql-statements.js';

test('catalog totals backfill existing data and follow inserts, status changes, deletes and rollbacks', async () => {
  const db = fixtureDatabase();
  try {
    // Exercise the upgrade path against an already populated catalog.
    for (const { name } of db.sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'catalog_totals_%'",
      )
      .all() as { name: string }[]) {
      db.sqlite.exec(`DROP TRIGGER ${name}`);
    }
    db.sqlite.exec('DROP TABLE catalog_totals');
    const migration = readFileSync(
      new URL('../d1/migrations/0004_catalog_totals.sql', import.meta.url),
      'utf8',
    );
    assert.equal(
      migration,
      readFileSync(
        new URL('../src/server/db/migrations/003_catalog_totals.sql', import.meta.url),
        'utf8',
      ),
    );
    // Use the same statement splitter as the real D1 integration.
    db.sqlite.transaction(() => {
      for (const sql of sqlStatements(migration)) db.sqlite.exec(sql);
    })();
    const repository = createCatalogRepository(db);
    const verify = async () => {
      const expected = db.sqlite
        .prepare(
          'SELECT (SELECT count(*) FROM mountain WHERE mntn_status=1) mountains,(SELECT count(*) FROM route WHERE route_status=1) routes,(SELECT count(*) FROM mountain) totalMountains,(SELECT count(*) FROM route) totalRoutes',
        )
        .get();
      const { snapshot, importedAt, ...actual } = await repository.stats();
      assert.deepEqual(actual, expected);
      assert.equal(snapshot, '2017-12-28');
      assert.ok(importedAt);
      for (const kind of [undefined, 'mountain', 'route'] as const) {
        const page = await repository.list({ kind });
        assert.equal(
          page.total,
          kind === 'mountain'
            ? actual.mountains
            : kind === 'route'
              ? actual.routes
              : actual.mountains + actual.routes,
        );
      }
    };
    await verify();
    db.sqlite.exec("INSERT INTO mountain(id,mntn_name,mntn_status) VALUES (99,'New summit',0)");
    await verify();
    db.sqlite.exec(
      'UPDATE mountain SET mntn_status=1 WHERE id=99; UPDATE route SET route_status=0 WHERE id=2',
    );
    await verify();
    db.sqlite.exec(
      'UPDATE mountain SET mntn_status=mntn_status; UPDATE route SET route_status=route_status',
    );
    await verify();
    assert.throws(
      () =>
        db.sqlite.transaction(() => {
          db.sqlite.exec(
            'DELETE FROM mountain WHERE id=99; UPDATE route SET route_status=1 WHERE id=2',
          );
          throw Error('rollback');
        })(),
      /rollback/,
    );
    await verify();
    db.sqlite.exec('DELETE FROM mountain WHERE id=99; DELETE FROM route WHERE id=2');
    await verify();
    const plans = db.sqlite
      .prepare('EXPLAIN QUERY PLAN SELECT * FROM catalog_totals WHERE id=1')
      .all() as { detail: string }[];
    assert.ok(
      plans.some((plan) => /SEARCH catalog_totals USING INTEGER PRIMARY KEY/.test(plan.detail)),
    );
  } finally {
    db.sqlite.close();
  }
});

test('generated SQL splitter keeps trigger bodies and nested CASE expressions intact', () => {
  const statements = sqlStatements(
    "CREATE TRIGGER sample AFTER INSERT ON mountain BEGIN UPDATE catalog_totals SET mountains=CASE WHEN 1 THEN 2 ELSE 0 END; UPDATE catalog_totals SET routes=3; END; SELECT 'END;';",
  );
  assert.equal(statements.length, 2);
  assert.match(statements[0], /routes=3; END$/);
  assert.equal(statements[1], "SELECT 'END;'");
  assert.throws(
    () => sqlStatements('CREATE TRIGGER sample AFTER INSERT ON mountain BEGIN SELECT 1;'),
    /Unterminated/,
  );
});
