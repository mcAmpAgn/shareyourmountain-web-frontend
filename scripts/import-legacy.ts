import { parseArgs } from 'node:util';
import { openDatabase, migrate } from '../src/server/db/connection.js';
import { loadConfig } from '../src/server/config.js';
import { readLegacyFile, importCatalog } from '../src/server/import/catalog-importer.js';
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { source: { type: 'string' }, snapshot: { type: 'string', default: '2017-12-28' } },
});
const source = values.source ?? positionals[0];
if (!source || positionals.length > 1)
  throw new Error('Usage: npm run db:import -- /path/to/backup.sql.zip [--snapshot YYYY-MM-DD]');
if (!/^\d{4}-\d{2}-\d{2}$/.test(values.snapshot!)) throw new Error('Invalid snapshot date');
const input = await readLegacyFile(source),
  db = openDatabase(loadConfig().databasePath);
try {
  migrate(db);
  console.log(
    JSON.stringify(importCatalog(db, input.sql, input.sha256, values.snapshot!), null, 2),
  );
} finally {
  db.sqlite.close();
}
