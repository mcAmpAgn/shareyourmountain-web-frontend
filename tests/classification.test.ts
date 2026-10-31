import test from 'node:test';
import assert from 'node:assert/strict';
import { classificationRows, filterClassification } from '../src/client/lib/classification.js';
import { fixtureDatabase } from './fixtures.js';
import { createCatalogRepository } from '../src/server/repositories/catalog-repository.js';

test('classification preserves ancestry, separates non-Alpine ranges and searches names and parents without accents', () => {
  const rows = classificationRows({
    ranges: [
      { id: 1, name: 'Alpi', parentId: null },
      { id: 2, name: 'Alpi Pennine', parentId: 1 },
      { id: 3, name: 'Alpi del Monte Rosa', parentId: 2 },
      { id: 4, name: 'Appennini', parentId: null },
      { id: 5, name: 'Broken cycle', parentId: 5 },
    ],
    groups: [
      { id: 8, name: 'Gruppo del Täschhorn', rangeId: 3 },
      { id: 9, name: 'Gruppo esterno', rangeId: null },
    ],
  });
  assert.deepEqual(
    filterClassification(rows, 'tasch', 'alpine', 'group', 2).map((x) => x.id),
    [8],
  );
  assert.equal(filterClassification(rows, 'Pennine', 'alpine', 'group', 0).length, 1);
  assert.equal(filterClassification(rows, 'Appennini', 'alpine', 'all', 0).length, 0);
  assert.equal(filterClassification(rows, 'Appennini', 'all', 'range', 0).length, 1);
  assert.equal(rows.find((x) => x.id === 3)?.level, 'Sottosezione');
  assert.deepEqual(rows.find((x) => x.id === 8)?.path, [
    'Alpi',
    'Alpi Pennine',
    'Alpi del Monte Rosa',
  ]);
});

test('catalog filters groups and descendant ranges including inherited route membership, excludes inactive items', async () => {
  const db = fixtureDatabase();
  try {
    db.sqlite
      .exec(`INSERT INTO mntn_mountainrange(id,mntnRange_name,mntnRange_dateIns,mntnRange_parentId) VALUES (20,'Alpi','now',NULL),(21,'Sottosezione','now',1);
      UPDATE mntn_mountainrange SET mntnRange_parentId=20 WHERE id=1;
      INSERT INTO mntn_mountaingroup(id,mntnGroup_name,mntnGroup_dateIns,mntnRange_id) VALUES (40,'Gruppo prova','now',21);
      UPDATE mountain SET mntnGroup_id=40,mntnRange_id=21 WHERE id IN (10,12);`);
    const repository = createCatalogRepository(db);
    const taxonomy = await repository.classification();
    assert.equal(taxonomy.groups[0].rangeId, 21);
    assert.equal(taxonomy.ranges.find((x) => x.id === 21)?.parentId, 1);
    assert.deepEqual(
      (await repository.list({ kind: 'mountain', groupId: 40 })).items.map((x) => x.id),
      [10],
    );
    assert.deepEqual(
      (await repository.list({ kind: 'route', groupId: 40 })).items.map((x) => x.id),
      [2],
    );
    assert.equal((await repository.list({ kind: 'mountain', rangeId: 20 })).total, 2);
    assert.equal((await repository.list({ kind: 'route', rangeId: 20 })).total, 1);
    assert.equal((await repository.list({ groupId: 999 })).total, 0);
    assert.equal((await repository.list({ rangeId: 999 })).total, 0);
    db.sqlite.exec(
      "INSERT INTO mntn_mountaingroup(id,mntnGroup_name,mntnGroup_dateIns) VALUES(999,'Other group','now'); UPDATE route SET mntnGroup_id=999 WHERE id=2",
    );
    assert.equal((await repository.list({ kind: 'route', groupId: 40 })).total, 0);
    assert.equal((await repository.list({ kind: 'route', groupId: 999 })).total, 1);
  } finally {
    db.sqlite.close();
  }
});
