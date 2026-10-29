import type { SqlDatabase } from './sql.js';
import type {
  CatalogItem,
  CatalogQuery,
  CatalogPage,
  Filters,
  Stats,
  ItemKind,
  SuggestionQuery,
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
  // Filtering, sorting and counts do not need card joins, country aggregation or route counts.
  const candidates = `SELECT 'm-'||m.id AS key,m.id,'mountain' AS kind,m.mntn_name AS name,
    m.mntn_altitude AS elevation_m,coalesce(m.mntnRange_id,0) AS range_id,NULL AS region_id,
    NULL AS country_id,NULL AS activity_id,NULL AS mountain_id,m.mntn_status AS active FROM mountain m
    UNION ALL SELECT 'r-'||r.id,r.id,'route',coalesce(nullif(trim(r.route_title),''),r.route_name),
    r.route_altitude,coalesce(r.mntnRange_id,m.mntnRange_id,0),r.region_id,r.country_id,
    r.activity_id,r.mountain_id,r.route_status FROM route r LEFT JOIN mountain m ON m.id=r.mountain_id`;
  async function selection(query: CatalogQuery, namesOnly = false) {
    const where = ['i.active=1'],
      params: (string | number)[] = [];
    if (query.q) {
      const words = query.q.normalize('NFC').match(/[\p{L}\p{N}]+/gu) ?? [];
      if (!words.length) where.push('0');
      else {
        where.push('i.key IN (SELECT entity_key FROM catalog_search WHERE catalog_search MATCH ?)');
        const match = words.map((w) => '"' + w + '"*').join(' AND ');
        params.push(namesOnly ? 'name : (' + match + ')' : match);
      }
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
    return { condition: where.join(' AND '), params };
  }
  async function getByKeys(keys: string[]): Promise<CatalogItem[]> {
    const items = new Map<string, CatalogItem>();
    for (let start = 0; start < keys.length; start += 80) {
      const batch = keys.slice(start, start + 80),
        parts: string[] = [],
        params: number[] = [];
      for (const [prefix, kind] of [
        ['m-', 'mountain'],
        ['r-', 'route'],
      ] as const) {
        const ids = batch
          .filter((key) => key.startsWith(prefix) && /^(m|r)-[1-9]\d*$/.test(key))
          .map((key) => Number(key.slice(2)))
          .filter((id) => Number.isSafeInteger(id) && id <= 2147483647);
        if (!ids.length) continue;
        parts.push(
          `SELECT * FROM catalog_items WHERE kind='${kind}' AND active=1 AND id IN (${ids.map(() => '?').join(',')})`,
        );
        params.push(...ids);
      }
      if (!parts.length) continue;
      for (const row of await database.prepare(parts.join(' UNION ALL ')).all(...params)) {
        const item = itemDTO(row as CatalogRow);
        items.set(item.key, item);
      }
    }
    return keys.flatMap((key) => (items.has(key) ? [items.get(key)!] : []));
  }
  async function pageItems(
    condition: string,
    params: (string | number)[],
    order: string,
    limit: number,
    offset = 0,
  ) {
    const targets = (await database
      .prepare(
        `SELECT i.key FROM (${candidates}) i WHERE ${condition} ORDER BY ${order} LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset)) as { key: string }[];
    return getByKeys(targets.map((row) => row.key));
  }
  async function list(query: CatalogQuery): Promise<CatalogPage> {
    const unfiltered =
      !query.q &&
      [
        query.activityId,
        query.rangeId,
        query.mountainId,
        query.minElevation,
        query.countryId,
        query.regionId,
      ].every((value) => value === undefined);
    const { condition, params } = await selection(query),
      total = unfiltered
        ? await activeTotal(query.kind)
        : (
            (await database
              .prepare('SELECT count(*) AS n FROM (' + candidates + ') i WHERE ' + condition)
              .get(...params)) as { n: number }
          ).n;
    const pageSize = query.pageSize ?? 12,
      pages = Math.max(1, Math.ceil(total / pageSize)),
      page = Math.min(query.page ?? 1, pages);
    const order =
      query.sort === 'elevation'
        ? 'i.elevation_m DESC,i.kind,i.id'
        : 'i.name COLLATE NOCASE,i.kind,i.id';
    return {
      items: await pageItems(condition, params, order, pageSize, (page - 1) * pageSize),
      total,
      page,
      pageSize,
      pages,
    };
  }
  async function activeTotal(kind?: ItemKind) {
    const column =
      kind === 'mountain' ? 'mountains' : kind === 'route' ? 'routes' : 'mountains + routes';
    return (
      (await database.prepare(`SELECT ${column} AS n FROM catalog_totals WHERE id=1`).get()) as {
        n: number;
      }
    ).n;
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
        'SELECT mountains,routes,total_mountains AS totalMountains,total_routes AS totalRoutes FROM catalog_totals WHERE id=1',
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
          'SELECT c.id,c.country_name AS name FROM geo_country c WHERE c.id IN (SELECT country_id FROM ass_mountaincountry UNION SELECT country_id FROM route WHERE route_status=1) ORDER BY c.country_name',
        )
        .all()) as Filters['countries'],
      regions: (await database
        .prepare(
          'SELECT id,region_name AS name,country_id AS countryId FROM geo_region WHERE id IN (SELECT region_id FROM ass_mountainregion UNION SELECT region_id FROM route WHERE route_status=1) ORDER BY region_name',
        )
        .all()) as Filters['regions'],
    };
  }
  return {
    list,
    suggestions: async (query: SuggestionQuery) => {
      const { condition, params } = await selection(query, true);
      return { items: await pageItems(condition, params, 'i.name COLLATE NOCASE,i.kind,i.id', 6) };
    },
    initialized: async () =>
      !!(await database.prepare('SELECT 1 AS ready FROM mountain LIMIT 1').get()),
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
    getByKeys,
    map: async (bbox: number[], minElevation: number) =>
      (
        await database
          .prepare(
            "SELECT * FROM catalog_items WHERE kind='mountain' AND active=1 AND longitude BETWEEN ? AND ? AND latitude BETWEEN ? AND ? AND elevation_m>=? ORDER BY elevation_m DESC,id LIMIT 1000",
          )
          .all(bbox[0], bbox[2], bbox[1], bbox[3], minElevation)
      ).map((row) => itemDTO(row as CatalogRow)),
  };
}
export type CatalogRepository = ReturnType<typeof createCatalogRepository>;
