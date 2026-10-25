import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { openDatabase } from '../src/server/db/connection.js';
import { loadConfig } from '../src/server/config.js';
if (!existsSync(loadConfig().databasePath))
  throw new Error('Database does not exist. Import the catalog before creating a backup.');
await mkdir('backups', { recursive: true });
const output = path.resolve(
  'backups',
  `shareyourmountain-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`,
);
const db = openDatabase(loadConfig().databasePath);
try {
  await db.sqlite.backup(output);
  console.log('Consistent backup created:', output);
} finally {
  db.sqlite.close();
}
