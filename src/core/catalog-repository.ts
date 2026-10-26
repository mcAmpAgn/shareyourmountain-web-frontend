import type { SqlDatabase } from './sql.js';
import type {
  CatalogItem,
  CatalogQuery,
  CatalogPage,
  Filters,
  Stats,
  ItemKind,
} from '../shared/contracts.js';
export interface CatalogRow {
  key: string;
  id: number;
  kind: ItemKind;
  name: string;
  elevation_m: number | null;
  range_name: string;
  region_name: string;
  countries: string;
  activity_name: string;
  activity_id: number | null;
  difficulty_raw: string | null;
  latitude: number | null;
  longitude: number | null;
  mountain_id: number | null;
  route_count: number;
  active: number;
}
export function itemDTO(row: CatalogRow): CatalogItem {
  return {
    key: row.key,
    id: row.id,
    kind: row.kind,
    name: row.name,
    elevationM: row.elevation_m,
    range: row.range_name,
    region: row.region_name,
    countries: row.countries ? row.countries.split(' · ') : [],
    activity: row.activity_name,
    activityId: row.activity_id,
    difficultyRaw: row.difficulty_raw,
    latitude: row.latitude,
    longitude: row.longitude,
    mountainId: row.mountain_id,
    routeCount: row.route_count,
  };
}
export function createCatalogRepository(database: SqlDatabase) {
  async function list(query: CatalogQuery): Promise<CatalogPage> {
    const where = ['i.active=1'],
      params: (string | number)[] = [];
    if (query.q) {
      const words = query.q.normalize('NFC').match(/[\p{L}\p{N}]+/gu) ?? [];
      if (!words.length)
        return { items: [], total: 0, page: 1, pageSize: query.pageSize ?? 12, pages: 1 };
      where.push('i.key IN (SELECT entity_key FROM catalog_search WHERE catalog_search MATCH ?)');
      params.push(words.map((w) => '"' + w + '"*').join(' AND '));
    }
    for (const [key, column] of [
      ['kind', 'kind'],
      ['activityId', 'activity_id'],
      ['rangeId', 'range_id'],
      ['mountainId', 'mountain_id'],
    ] as const) {
      if (query[key] !== undefined) {
        where.push(`i.${column}=?`);
        params.push(query[key]!);
      }
    }
    if (query.minElevation !== undefined) {
      where.push('i.elevation_m>=?');
      params.push(query.minElevation);
    }
    if (query.countryId !== undefined) {
      where.push(
        "((i.kind='route' AND i.country_id=?) OR (i.kind='mountain' AND EXISTS (SELECT 1 FROM ass_mountaincountry a WHERE a.mntn_id=i.id AND a.country_id=?)))",
      );
      params.push(query.countryId, query.countryId);
    }
    if (query.regionId !== undefined) {
      where.push(
        "((i.kind='route' AND i.region_id=?) OR (i.kind='mountain' AND EXISTS (SELECT 1 FROM ass_mountainregion a WHERE a.mntn_id=i.id AND a.region_id=?)))",
      );
      params.push(query.regionId, query.regionId);
    }
    const condition = where.join(' AND '),
      total = (
        (await database
          .prepare('SELECT count(*) AS n FROM catalog_items i WHERE ' + condition)
          .get(...params)) as { n: number }
      ).n;
    const pageSize = query.pageSize ?? 12,
      pages = Math.max(1, Math.ceil(total / pageSize)),
      page = Math.min(query.page ?? 1, pages);
    const order =
      query.sort === 'elevation'
        ? 'i.elevation_m DESC,i.kind,i.id'
        : 'i.name COLLATE NOCASE,i.kind,i.id';
    const rows = (await database
      .prepare(
        `SELECT i.* FROM catalog_items i WHERE ${condition} ORDER BY ${order} LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, (page - 1) * pageSize)) as CatalogRow[];
    return { items: rows.map(itemDTO), total, page, pageSize, pages };
  }
  async function get(kind: ItemKind, id: number) {
    const row = (await database
      .prepare('SELECT * FROM catalog_items WHERE kind=? AND id=? AND active=1')
      .get(kind, id)) as CatalogRow | undefined;
    return row ? itemDTO(row) : null;
  }
  async function stats(): Promise<Stats> {
    const counts = (await database
      .prepare(
        "SELECT sum(kind='mountain' AND active=1) mountains,sum(kind='route' AND active=1) routes,sum(kind='mountain') totalMountains,sum(kind='route') totalRoutes FROM catalog_items",
      )
      .get()) as Record<string, number>;
    const batch = (await database
      .prepare('SELECT snapshot,imported_at FROM import_batches ORDER BY id DESC LIMIT 1')
      .get()) as { snapshot: string; imported_at: string } | undefined;
    return {
      mountains: counts.mountains ?? 0,
      routes: counts.routes ?? 0,
      totalMountains: counts.totalMountains ?? 0,
      totalRoutes: counts.totalRoutes ?? 0,
      snapshot: batch?.snapshot ?? null,
      importedAt: batch?.imported_at ?? null,
    };
  }
  async function filters(): Promise<Filters> {
    return {
      activities: (await database
        .prepare(
          'SELECT a.id,a.activity_name AS name FROM act_activity a WHERE EXISTS(SELECT 1 FROM route r WHERE r.activity_id=a.id AND r.route_status=1) ORDER BY a.activity_order,a.activity_name',
        )
        .all()) as Filters['activities'],
      ranges: (await database
        .prepare(
          'SELECT id,mntnRange_name AS name FROM mntn_mountainrange WHERE mntnRange_name IS NOT NULL ORDER BY mntnRange_name',
        )
        .all()) as Filters['ranges'],
      countries: (await database
        .prepare(
          'SELECT c.id,c.country_name AS name FROM geo_country c WHERE EXISTS(SELECT 1 FROM ass_mountaincountry a WHERE a.country_id=c.id) OR EXISTS(SELECT 1 FROM route r WHERE r.country_id=c.id AND r.route_status=1) ORDER BY c.country_name',
        )
        .all()) as Filters['countries'],
      regions: (await database
        .prepare(
          'SELECT id,region_name AS name,country_id AS countryId FROM geo_region g WHERE EXISTS(SELECT 1 FROM ass_mountainregion a WHERE a.region_id=g.id) OR EXISTS(SELECT 1 FROM route r WHERE r.region_id=g.id AND r.route_status=1) ORDER BY region_name',
        )
        .all()) as Filters['regions'],
    };
  }
  return {
    list,
    get,
    stats,
    filters,
    rawMountain: async (id: number) =>
      (await database.prepare('SELECT * FROM mountain WHERE id=?').get(id)) as
        Record<string, unknown> | undefined,
    rawRoute: async (id: number) =>
      (await database.prepare('SELECT * FROM route WHERE id=?').get(id)) as
        Record<string, unknown> | undefined,
    sources: async (id: number) =>
      (await database
        .prepare(
          'SELECT s.source_name AS name,s.source_url AS base,w.wi_url AS path FROM route_webinfo w LEFT JOIN source s ON s.id=w.source_id WHERE w.route_id=? ORDER BY w.id',
        )
        .all(id)) as { name: string | null; base: string | null; path: string }[],
    images: async (kind: ItemKind, id: number) =>
      (await database
        .prepare(
          kind === 'mountain'
            ? 'SELECT image_url,image_cdn,image_descr FROM mntn_image WHERE mountain_id=? ORDER BY image_cover DESC,id LIMIT 12'
            : 'SELECT image_url,image_cdn,image_descr FROM route_image WHERE route_id=? ORDER BY image_cover DESC,id LIMIT 12',
        )
        .all(id)) as { image_url: string; image_cdn: number; image_descr: string | null }[],
    descriptions: async (id: number) =>
      (await database
        .prepare(
          'SELECT dbpedia_abstract AS description,wikipedia_url AS url FROM mntn_dbpedia WHERE mountain_id=? ORDER BY language_id LIMIT 1',
        )
        .get(id)) as { description: string | null; url: string | null } | undefined,
    parking: async (id: number) =>
      (await database
        .prepare(
          'SELECT parking_name AS name,parking_lat AS latitude,parking_lng AS longitude FROM parking WHERE id=?',
        )
        .get(id)) as
        { name: string; latitude: number | null; longitude: number | null } | undefined,
    track: async (id: number) =>
      (await database
        .prepare('SELECT track_name AS name,track_url AS url FROM trackgps WHERE id=?')
        .get(id)) as { name: string; url: string | null } | undefined,
    getByKeys: async (keys: string[]) => {
      const items: CatalogItem[] = [];
      for (let start = 0; start < keys.length; start += 80) {
        const batch = keys.slice(start, start + 80);
        const rows = await database
          .prepare(
            `SELECT * FROM catalog_items WHERE active=1 AND key IN (${batch.map(() => '?').join(',')})`,
          )
          .all(...batch);
        items.push(...rows.map((row) => itemDTO(row as CatalogRow)));
      }
      return items;
    },
    map: async (bbox: number[], minElevation: number) =>
      (
        await database
          .prepare(
            "SELECT * FROM catalog_items WHERE kind='mountain' AND active=1 AND longitude BETWEEN ? AND ? AND latitude BETWEEN ? AND ? AND elevation_m>=? ORDER BY elevation_m DESC,id LIMIT 1000",
          )
          .all(bbox[0], bbox[2], bbox[1], bbox[3], minElevation)
      ).map((r) => itemDTO(r as CatalogRow)),
  };
}
export type CatalogRepository = ReturnType<typeof createCatalogRepository>;
