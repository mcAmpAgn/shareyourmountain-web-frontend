import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as schema from './schema.js';

export function openDatabase(filename: string) {
  if (filename !== ':memory:') mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const sqlite = new Database(filename);
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('journal_mode = WAL');
  return { sqlite, orm: drizzle(sqlite, { schema }) };
}
export type AppDatabase = ReturnType<typeof openDatabase>;
export function migrate(db: AppDatabase) {
  const dir = fileURLToPath(new URL('./migrations/', import.meta.url));
  db.sqlite.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY,sha256 TEXT NOT NULL,applied_at TEXT NOT NULL)',
  );
  for (const name of readdirSync(dir)
    .filter((n) => n.endsWith('.sql'))
    .sort()) {
    const sql = readFileSync(path.join(dir, name), 'utf8').replace(/\r\n/g, '\n'),
      hash = createHash('sha256').update(sql).digest('hex');
    const previous = db.sqlite
      .prepare('SELECT sha256 FROM schema_migrations WHERE name=?')
      .get(name) as { sha256: string } | undefined;
    if (previous) {
      if (previous.sha256 !== hash) {
        // Accept an older checksum only when the SQL differs solely in line endings.
        const crlfHash = createHash('sha256').update(sql.replace(/\n/g, '\r\n')).digest('hex');
        if (previous.sha256 !== crlfHash)
          throw new Error(`Previously applied migration changed: ${name}`);
        db.sqlite.prepare('UPDATE schema_migrations SET sha256=? WHERE name=?').run(hash, name);
      }
      continue;
    }
    db.sqlite.transaction(() => {
      db.sqlite.exec(sql);
      db.sqlite
        .prepare('INSERT INTO schema_migrations VALUES (?,?,?)')
        .run(name, hash, new Date().toISOString());
    })();
  }
}
