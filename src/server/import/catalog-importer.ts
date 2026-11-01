import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import type { AppDatabase } from '../db/connection.js';
import { readTableRows } from './sql-parser.js';
export const publicTables = [
  'geo_country',
  'geo_region',
  'geo_city',
  'language',
  'act_activity',
  'act_difficulty',
  'mntn_mountainrange',
  'mntn_mountaingroup',
  'valley',
  'stone',
  'mountain',
  'ass_mountaincountry',
  'ass_mountainregion',
  'mntn_dbpedia',
  'mntn_image',
  'parking',
  'trackgps',
  'route',
  'route_image',
  'source',
  'route_webinfo',
] as const;
export interface ImportReport {
  snapshot: string;
  sha256: string;
  counts: Record<string, number>;
  issues: number;
  activeMountains: number;
  activeRoutes: number;
  unchanged?: boolean;
}
interface Issue {
  table: string;
  id: string;
  field: string;
  reason: string;
  original: string;
}
export async function readLegacyFile(filename: string) {
  const bytes = await readFile(filename);
  if (bytes.length > 100 * 1024 * 1024) throw new Error('Source exceeds 100 MB');
  if (filename.toLowerCase().endsWith('.zip')) {
    const files = unzipSync(bytes, {
      filter: (entry) =>
        entry.name.endsWith('.sql') &&
        !entry.name.startsWith('__MACOSX/') &&
        entry.originalSize <= 100 * 1024 * 1024,
    });
    const names = Object.keys(files);
    if (names.length !== 1) throw new Error('Expected exactly one SQL member');
    return {
      sql: strFromU8(files[names[0]]),
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }
  return { sql: bytes.toString('utf8'), sha256: createHash('sha256').update(bytes).digest('hex') };
}
export function importCatalog(
  db: AppDatabase,
  sql: string,
  sha256: string,
  snapshot: string,
): ImportReport {
  const previous = db.sqlite
    .prepare('SELECT report_json FROM import_batches WHERE sha256=?')
    .get(sha256) as { report_json: string } | undefined;
  if (previous) return { ...JSON.parse(previous.report_json), unchanged: true };
  if (
    (db.sqlite.prepare('SELECT count(*) AS n FROM mountain').get() as { n: number }).n ||
    (db.sqlite.prepare('SELECT count(*) AS n FROM route').get() as { n: number }).n
  )
    throw new Error(
      'Catalog already contains data. Import into a new database; existing databases are never overwritten.',
    );
  const issues: Issue[] = [],
    counts: Record<string, number> = {};
  const tables = publicTables.map((name) => ({ name, rows: readTableRows(sql, name) }));
  if (
    !tables.find((t) => t.name === 'mountain')!.rows.length ||
    !tables.find((t) => t.name === 'route')!.rows.length
  )
    throw new Error('Source must contain mountain and route data');
  const report: ImportReport = {
    snapshot,
    sha256,
    counts,
    issues: 0,
    activeMountains: 0,
    activeRoutes: 0,
  };
  db.sqlite.transaction(() => {
    db.sqlite.pragma('defer_foreign_keys = ON');
    const batchId = Number(
      db.sqlite
        .prepare(
          'INSERT INTO import_batches(sha256,snapshot,imported_at,report_json) VALUES (?,?,?,?)',
        )
        .run(sha256, snapshot, new Date().toISOString(), '{}').lastInsertRowid,
    );
    for (const { name, rows } of tables) {
      if (name === 'stone') {
        const identity = db.sqlite.prepare('INSERT OR IGNORE INTO stone_types(id) VALUES (?)');
        for (const row of rows) identity.run(row.id as number);
      }
      const schema = db.sqlite.prepare(`PRAGMA table_info("${name}")`).all() as { name: string }[];
      const allowed = new Set(schema.map((c) => c.name));
      counts[name] = rows.length;
      if (!rows.length) continue;
      const columns = Object.keys(rows[0]).filter((c) => c !== 'user_id');
      if (columns.some((c) => !allowed.has(c)))
        throw new Error(`Unsupported source columns in ${name}`);
      const insert = db.sqlite.prepare(
        `INSERT INTO "${name}" (${columns.map((c) => '"' + c + '"').join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
      );
      for (const original of rows) {
        const row = { ...original };
        const issue = (field: string, reason: string) =>
          issues.push({
            table: name,
            id: String(row.id ?? row.mntn_id ?? ''),
            field,
            reason,
            original: JSON.stringify(original[field]) ?? 'null',
          });
        const pair =
          name === 'mountain'
            ? ['mntn_latitude', 'mntn_longitude']
            : name === 'route'
              ? ['route_lat', 'route_lng']
              : name === 'parking'
                ? ['parking_lat', 'parking_lng']
                : name === 'valley'
                  ? ['valley_lat', 'valley_lng']
                  : name === 'geo_city'
                    ? ['city_latitude', 'city_longitude']
                    : null;
        if (pair) {
          const [lat, lng] = pair;
          const valid =
            typeof row[lat] === 'number' &&
            typeof row[lng] === 'number' &&
            row[lat] !== 0 &&
            row[lng] !== 0 &&
            Math.abs(row[lat] as number) <= 90 &&
            Math.abs(row[lng] as number) <= 180;
          if (!valid) {
            for (const col of pair) {
              if (row[col] !== null && row[col] !== undefined)
                issue(col, 'Missing partner, zero sentinel, or out-of-range coordinate');
              row[col] = null;
            }
          }
        }
        if (name === 'route') {
          for (const field of [
            'route_length',
            'route_height',
            'route_altitude',
            'route_approachAltitude',
            'route_approachHeight',
            'route_approachLength',
          ])
            if (row[field] === 0) {
              issue(field, 'Zero treated as unknown; source preserved in audit');
              row[field] = null;
            }
          if (row.route_status === 1) report.activeRoutes++;
        }
        if (name === 'mountain') {
          if (typeof row.mntn_altitude === 'number' && row.mntn_altitude < 100)
            issue('mntn_altitude', 'Low historical elevation: retained for review');
          if (row.mntn_status === 1) report.activeMountains++;
        }
        insert.run(...columns.map((c) => row[c] as string | number | null));
      }
    }
    const violations = db.sqlite.pragma('foreign_key_check') as unknown[];
    if (violations.length)
      throw new Error(`Import rejected: ${violations.length} foreign-key violations`);
    db.sqlite.exec(
      "INSERT INTO catalog_search(entity_key,name,location) SELECT key,name,range_name||' '||region_name||' '||countries FROM catalog_items WHERE active=1",
    );
    db.sqlite.exec(
      'INSERT INTO catalog_search_keys(entity_key,search_rowid) SELECT entity_key,rowid FROM catalog_search',
    );
    const insertIssue = db.sqlite.prepare(
      'INSERT INTO import_issues(batch_id,table_name,record_id,field,reason,original_value) VALUES (?,?,?,?,?,?)',
    );
    for (const issue of issues)
      insertIssue.run(batchId, issue.table, issue.id, issue.field, issue.reason, issue.original);
    report.issues = issues.length;
    db.sqlite
      .prepare('UPDATE import_batches SET report_json=? WHERE id=?')
      .run(JSON.stringify(report), batchId);
  })();
  const integrity = db.sqlite.pragma('integrity_check', { simple: true });
  if (integrity !== 'ok') throw new Error('SQLite integrity check failed');
  return report;
}
