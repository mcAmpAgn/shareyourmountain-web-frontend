import test from 'node:test';
import assert from 'node:assert/strict';
import { isReleasePathAllowed, releaseEntries } from '../scripts/package-release.js';
test('release packaging excludes runtime data and secrets while retaining migrations and maintenance tools', () => {
  for (const name of [
    'data/catalog.sqlite',
    'backups/catalog.sqlite',
    'src/server/.env',
    'node_modules/pkg/index.js',
    '../outside',
    'dump.sql.zip',
    '.env.production',
    'src/server/db/local.db-wal',
  ])
    assert.equal(isReleasePathAllowed(name), false, name);
  for (const name of [
    'src/server/db/migrations/001_catalog.sql',
    '.env.example',
    'scripts/import-legacy.ts',
    'dist/client/assets/index.js',
  ])
    assert.equal(isReleasePathAllowed(name), true, name);
  assert.ok(releaseEntries.includes('scripts/import-legacy.ts'));
  assert.ok(releaseEntries.includes('scripts/backup.ts'));
  assert.ok(!releaseEntries.includes('data'));
});
