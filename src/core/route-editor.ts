import { editorETag } from './editor-version.js';
import type { EditableRoute } from '../shared/contracts.js';
import { z } from 'zod';
import type { SqlDatabase, SqlValue } from './sql.js';
import { ApplicationError } from './adventure-service.js';
const positiveId = z.number().int().positive().max(2147483647);
export const routeChanges = z
  .object({
    name: z.string().trim().min(1).max(250).optional(),
    title: z.string().trim().min(1).max(250).nullable().optional(),
    area: z.string().trim().max(500).nullable().optional(),
    activityId: positiveId.nullable().optional(),
    difficultyRaw: z.string().trim().max(250).nullable().optional(),
    elevationM: z.number().int().min(-500).max(9000).nullable().optional(),
    lengthM: z.number().int().min(0).max(1000000).nullable().optional(),
    heightM: z.number().int().min(0).max(15000).nullable().optional(),
    lengthDescription: z.string().max(8000).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Provide a change');
const columns = {
  name: 'route_name',
  title: 'route_title',
  area: 'route_area',
  activityId: 'activity_id',
  difficultyRaw: 'difficulty_grade',
  elevationM: 'route_altitude',
  lengthM: 'route_length',
  heightM: 'route_height',
  lengthDescription: 'route_lengthDescr',
  latitude: 'route_lat',
  longitude: 'route_lng',
} as const;
export type RouteChanges = z.infer<typeof routeChanges>;
const selection =
  'id,' +
  Object.entries(columns)
    .map(([key, col]) => col + ' AS ' + key)
    .join(',') +
  ',route_dateMod AS updatedAt';
export function createRouteEditor(db: SqlDatabase) {
  async function get(id: number) {
    const route = (await db
      .prepare('SELECT ' + selection + ' FROM route WHERE id=? AND route_status=1')
      .get(id)) as EditableRoute | undefined;
    if (!route) throw new ApplicationError(404, 'Itinerario non disponibile.');
    return { route, etag: await editorETag(route) };
  }
  return {
    get,
    async patch(id: number, body: unknown, ifMatch: string | undefined | null) {
      if (!ifMatch)
        throw new ApplicationError(428, 'È richiesto If-Match: leggi prima la versione corrente.');
      const changes = routeChanges.parse(body),
        current = await get(id);
      if (ifMatch !== current.etag)
        throw new ApplicationError(
          412,
          'La scheda è stata modificata. Rileggila prima di salvare.',
        );
      const merged = { ...current.route, ...changes };
      if (!String(merged.title ?? '').trim() && !String(merged.name ?? '').trim())
        throw new ApplicationError(400, 'È richiesto un nome o un titolo.');
      if ((merged.latitude === null) !== (merged.longitude === null))
        throw new ApplicationError(
          400,
          'Latitudine e longitudine devono essere entrambe presenti o entrambe nulle.',
        );
      if (
        changes.activityId != null &&
        !(await db.prepare('SELECT id FROM act_activity WHERE id=?').get(changes.activityId))
      )
        throw new ApplicationError(400, 'Attività non valida.');
      const entries = Object.entries(changes) as [keyof typeof columns, SqlValue][];
      const previous = Object.entries(columns);
      // Compare the entire editable snapshot in the UPDATE to close the read/write race.
      const updated = await db
        .prepare(
          'UPDATE route SET ' +
            entries.map(([key]) => columns[key] + '=?').join(',') +
            ',route_dateMod=? WHERE id=? AND route_status=1 AND route_dateMod IS ? AND ' +
            previous.map(([, col]) => col + ' IS ?').join(' AND ') +
            ' RETURNING id',
        )
        .get(
          ...entries.map(([, value]) => value),
          new Date().toISOString(),
          id,
          current.route.updatedAt,
          ...previous.map(([key]) => current.route[key as keyof typeof columns]),
        );
      if (!updated)
        throw new ApplicationError(
          412,
          'La scheda è cambiata durante il salvataggio. Rileggila e riprova.',
        );
      return get(id);
    },
  };
}
