import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { publicTables } from '../src/server/import/catalog-importer.js';
export function sqlValue(value: unknown): string {
  if (value === null) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Invalid numeric catalog value');
    return String(value);
  }
  if (typeof value !== 'string') throw new Error('Unsupported catalog value');
  if (value.includes('\0')) return `CAST(X'${Buffer.from(value, 'utf8').toString('hex')}' AS TEXT)`;
  return "'" + value.replaceAll("'", "''") + "'";
}
/** Explicit public-table and column selection, never SQLite's unrestricted .dump. */
export function exportD1Catalog(db: Database.Database) {
  return db.transaction(() => {
    const metadata = db
      .prepare('SELECT snapshot FROM import_batches ORDER BY id DESC LIMIT 1')
      .get() as { snapshot: string } | undefined;
    if (!metadata)
      throw new Error('Import an authorized catalog into local SQLite before exporting.');
    const lines: string[] = [],
      counts: Record<string, number> = {};
    for (const table of ['stone_types', ...publicTables]) {
      const columns = (db.pragma(`table_info("${table}")`) as { name: string }[])
        .map((c) => c.name)
        .filter((c) => c !== 'user_id');
      const quoted = columns.map((c) => '"' + c + '"').join(',');
      const rows = db
        .prepare(
          `SELECT ${quoted} FROM "${table}" ORDER BY ${columns.map((c) => '"' + c + '"').join(',')}`,
        )
        .all() as Record<string, unknown>[];
      counts[table] = rows.length;
      const prefix = `INSERT INTO "${table}" (${quoted}) VALUES `;
      let tuples: string[] = [],
        bytes = Buffer.byteLength(prefix) + 2;
      const flush = () => {
        if (tuples.length) lines.push(prefix + tuples.join(',') + ';');
        tuples = [];
        bytes = Buffer.byteLength(prefix) + 2;
      };
      for (const row of rows) {
        const tuple = '(' + columns.map((c) => sqlValue(row[c])).join(',') + ')';
        const size = Buffer.byteLength(tuple) + 1;
        if (tuples.length >= 100 || bytes + size > 80000) flush();
        if (bytes + size > 80000)
          throw new Error(`Catalog row exceeds D1 statement budget in ${table}`);
        tuples.push(tuple);
        bytes += size;
      }
      flush();
    }
    if (!counts.mountain || !counts.route) throw new Error('Source catalog is empty');
    const body = lines.join('\n'),
      sha256 = createHash('sha256').update(body).digest('hex');
    const sql =
      [
        '-- Generated public catalog only. Never includes accounts, notes or local profiles.',
        'PRAGMA defer_foreign_keys=ON;',
        `INSERT INTO catalog_imports(id,sha256,snapshot,counts_json) VALUES (1,${sqlValue(sha256)},${sqlValue(metadata.snapshot)},${sqlValue(JSON.stringify(counts))});`,
        body,
        `INSERT INTO import_batches(sha256,snapshot,imported_at,report_json) VALUES (${sqlValue(sha256)},${sqlValue(metadata.snapshot)},${sqlValue(new Date().toISOString())},${sqlValue(JSON.stringify({ counts, snapshot: metadata.snapshot, sha256 }))});`,
        "INSERT INTO catalog_search(entity_key,name,location) SELECT key,name,range_name||' '||region_name||' '||countries FROM catalog_items WHERE active=1;",
        'PRAGMA defer_foreign_keys=OFF;',
      ].join('\n') + '\n';
    return { sql, counts, sha256, snapshot: metadata.snapshot };
  })();
}
