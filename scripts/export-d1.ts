import Database from 'better-sqlite3';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadConfig } from '../src/server/config.js';
import { exportD1Catalog } from './d1-export.js';
const db = new Database(loadConfig().databasePath, { readonly: true, fileMustExist: true });
try {
  const result = exportD1Catalog(db);
  const folder = path.resolve('d1/exports');
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, 'catalog.sql'), result.sql);
  console.log(
    JSON.stringify(
      {
        file: 'd1/exports/catalog.sql',
        snapshot: result.snapshot,
        sha256: result.sha256,
        counts: result.counts,
      },
      null,
      2,
    ),
  );
} finally {
  db.close();
}
