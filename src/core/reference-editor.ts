import { z } from 'zod';
import { ApplicationError } from './adventure-service.js';
import { editorETag, checkEditorVersion } from './editor-version.js';
import type { SqlDatabase, SqlValue } from './sql.js';
import type { EditableSource, EditableRouteWebinfo } from '../shared/contracts.js';
import { safeURL } from './catalog-service.js';
const id = z.number().int().positive().max(2147483647);
const httpURL = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((v) => safeURL(v) !== null, 'Use an absolute HTTP(S) URL without credentials')
  .transform((v) => new URL(v).href);
const sourceFields = z.object({
  name: z.string().trim().min(1).max(250),
  url: httpURL.nullable(),
  logo: httpURL.nullable(),
});
const sourceCreate = sourceFields
  .extend({ url: httpURL.nullable().default(null), logo: httpURL.nullable().default(null) })
  .strict();
const sourcePatch = sourceFields
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0);
const webFields = z.object({
  url: httpURL,
  sourceId: id.nullable(),
  summary: z.string().trim().max(4000).nullable(),
  rate: z.string().trim().max(100).nullable(),
  languageCode: z
    .string()
    .trim()
    .regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/)
    .max(20)
    .nullable(),
});
const webCreate = webFields
  .extend({
    sourceId: id.nullable().default(null),
    summary: webFields.shape.summary.default(null),
    rate: webFields.shape.rate.default(null),
    languageCode: webFields.shape.languageCode.default(null),
  })
  .strict();
const webPatch = webFields
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0);
const sourceColumns = { name: 'source_name', url: 'source_url', logo: 'source_logo' } as const;
const webColumns = {
  url: 'wi_url',
  sourceId: 'source_id',
  summary: 'wi_summary',
  rate: 'wi_rate',
  languageCode: 'language_code',
} as const;
const sourceSelect =
  'id,source_name AS name,source_url AS url,source_logo AS logo,source_dateIns AS createdAt';
const webSelect =
  'id,route_id AS routeId,source_id AS sourceId,wi_url AS url,wi_summary AS summary,wi_rate AS rate,language_code AS languageCode,wi_dateIns AS createdAt,wi_dateMod AS updatedAt';
const changed = () =>
  new ApplicationError(412, 'La scheda è cambiata durante il salvataggio. Rileggila.');
export function createReferenceEditor(db: SqlDatabase) {
  async function route(routeId: number) {
    if (!(await db.prepare('SELECT id FROM route WHERE id=? AND route_status=1').get(routeId)))
      throw new ApplicationError(404, 'Itinerario non disponibile.');
  }
  async function getSource(sourceId: number) {
    const record = (await db
      .prepare('SELECT ' + sourceSelect + ' FROM source WHERE id=?')
      .get(sourceId)) as EditableSource | undefined;
    if (!record) throw new ApplicationError(404, 'Fonte non disponibile.');
    return { record, etag: await editorETag(record) };
  }
  async function getWebinfo(routeId: number, webId: number) {
    await route(routeId);
    const record = (await db
      .prepare('SELECT ' + webSelect + ' FROM route_webinfo WHERE route_id=? AND id=?')
      .get(routeId, webId)) as EditableRouteWebinfo | undefined;
    if (!record)
      throw new ApplicationError(404, 'Collegamento non disponibile per questo itinerario.');
    return { record, etag: await editorETag(record) };
  }
  async function validateSource(sourceId: number | null | undefined) {
    if (sourceId != null && !(await db.prepare('SELECT id FROM source WHERE id=?').get(sourceId)))
      throw new ApplicationError(400, 'Fonte non valida.');
  }
  return {
    getSource,
    getWebinfo,
    async sources(q: string, after: number) {
      // Escape LIKE wildcards: the supplied text is a literal name prefix.
      const prefix = q.replace(/[\\%_]/g, (c) => '\\' + c) + '%';
      const rows = (await db
        .prepare(
          'SELECT ' +
            sourceSelect +
            " FROM source WHERE id>? AND source_name LIKE ? ESCAPE '\\' ORDER BY id LIMIT 51",
        )
        .all(after, prefix)) as EditableSource[];
      return { items: rows.slice(0, 50), nextAfter: rows.length > 50 ? rows[49].id : null };
    },
    async createSource(body: unknown) {
      const value = sourceCreate.parse(body);
      const created = (await db
        .prepare(
          'INSERT INTO source(source_name,source_url,source_logo) SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM source WHERE source_url=? AND ? IS NOT NULL) RETURNING id',
        )
        .get(value.name, value.url, value.logo, value.url, value.url)) as
        { id: number } | undefined;
      if (!created) throw new ApplicationError(409, 'Esiste già una fonte con questo URL.');
      return getSource(created.id);
    },
    async patchSource(sourceId: number, body: unknown, ifMatch: string | null | undefined) {
      const changes = sourcePatch.parse(body),
        current = await getSource(sourceId);
      await checkEditorVersion(current.record, ifMatch);
      const values = Object.entries(changes) as [keyof typeof sourceColumns, SqlValue][];
      const snapshot = Object.entries(sourceColumns);
      const updated = await db
        .prepare(
          'UPDATE source SET ' +
            values.map(([k]) => sourceColumns[k] + '=?').join(',') +
            ' WHERE id=? AND ' +
            snapshot.map(([, col]) => col + ' IS ?').join(' AND ') +
            ' RETURNING id',
        )
        .get(
          ...values.map(([, v]) => v),
          sourceId,
          ...snapshot.map(([k]) => current.record[k as keyof typeof sourceColumns]),
        );
      if (!updated) throw changed();
      return getSource(sourceId);
    },
    async webinfo(routeId: number, after: number) {
      await route(routeId);
      const rows = (await db
        .prepare(
          'SELECT ' +
            webSelect +
            ' FROM route_webinfo WHERE route_id=? AND id>? ORDER BY id LIMIT 51',
        )
        .all(routeId, after)) as EditableRouteWebinfo[];
      return { items: rows.slice(0, 50), nextAfter: rows.length > 50 ? rows[49].id : null };
    },
    async createWebinfo(routeId: number, body: unknown) {
      const value = webCreate.parse(body);
      await route(routeId);
      await validateSource(value.sourceId);
      const created = (await db
        .prepare(
          'INSERT INTO route_webinfo(route_id,source_id,wi_url,wi_summary,wi_rate,language_code) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM route WHERE id=? AND route_status=1) AND NOT EXISTS (SELECT 1 FROM route_webinfo WHERE route_id=? AND wi_url=?) RETURNING id',
        )
        .get(
          routeId,
          value.sourceId,
          value.url,
          value.summary,
          value.rate,
          value.languageCode,
          routeId,
          routeId,
          value.url,
        )) as { id: number } | undefined;
      if (!created) {
        await route(routeId);
        throw new ApplicationError(409, 'Questo collegamento è già associato alla via.');
      }
      return getWebinfo(routeId, created.id);
    },
    async patchWebinfo(
      routeId: number,
      webId: number,
      body: unknown,
      ifMatch: string | null | undefined,
    ) {
      const changes = webPatch.parse(body),
        current = await getWebinfo(routeId, webId);
      await checkEditorVersion(current.record, ifMatch);
      await validateSource(changes.sourceId);
      // Existing relative URLs retain their meaning if their source is reassigned.
      if (
        changes.sourceId !== undefined &&
        changes.sourceId !== current.record.sourceId &&
        changes.url === undefined &&
        !safeURL(current.record.url)
      )
        throw new ApplicationError(
          400,
          'Per cambiare fonte di un URL relativo, invia anche un URL assoluto.',
        );
      const values = Object.entries(changes) as [keyof typeof webColumns, SqlValue][];
      const snapshot = Object.entries(webColumns);
      const updated = await db
        .prepare(
          'UPDATE route_webinfo SET ' +
            values.map(([k]) => webColumns[k] + '=?').join(',') +
            ',wi_dateMod=? WHERE route_id=? AND id=? AND wi_dateMod IS ? AND ' +
            snapshot.map(([, col]) => col + ' IS ?').join(' AND ') +
            ' AND EXISTS (SELECT 1 FROM route WHERE id=? AND route_status=1) RETURNING id',
        )
        .get(
          ...values.map(([, v]) => v),
          new Date().toISOString(),
          routeId,
          webId,
          current.record.updatedAt,
          ...snapshot.map(([k]) => current.record[k as keyof typeof webColumns]),
          routeId,
        );
      if (!updated) throw changed();
      return getWebinfo(routeId, webId);
    },
  };
}
