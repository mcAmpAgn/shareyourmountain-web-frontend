import { z } from 'zod';
import { catalogId } from './validation.js';
import { createReferenceEditor } from './reference-editor.js';
import type { SqlDatabase } from './sql.js';
export const referenceEditorPath =
  /^\/api\/editor\/(?:sources(?:\/[^/]+)?|routes\/[^/]+\/webinfo(?:\/[^/]+)?)$/;
const listQuery = z
  .object({
    q: z.string().trim().max(250).default(''),
    after: z.coerce.number().int().min(0).max(2147483647).default(0),
  })
  .strict();
/** Shared HTTP use cases; adapters own authentication, origin checks and body limits. */
export async function referenceEditorHTTP(
  db: SqlDatabase,
  path: string,
  method: string,
  query: unknown,
  readBody: () => Promise<unknown>,
  ifMatch: string | null | undefined,
) {
  const editor = createReferenceEditor(db),
    parts = path.split('/');
  const source = parts[3] === 'sources';
  const routeId = source ? undefined : catalogId.parse(parts[4]);
  const rawId = source ? parts[4] : parts[6];
  const itemId = rawId === undefined ? undefined : catalogId.parse(rawId);
  if (method === 'GET' && itemId === undefined) {
    const { q, after } = listQuery.parse(query);
    return {
      body: source ? await editor.sources(q, after) : await editor.webinfo(routeId!, after),
      status: 200,
    };
  }
  let result;
  if (method === 'GET')
    result = source ? await editor.getSource(itemId!) : await editor.getWebinfo(routeId!, itemId!);
  else if (method === 'POST' && itemId === undefined)
    result = source
      ? await editor.createSource(await readBody())
      : await editor.createWebinfo(routeId!, await readBody());
  else if (method === 'PATCH' && itemId !== undefined)
    result = source
      ? await editor.patchSource(itemId, await readBody(), ifMatch)
      : await editor.patchWebinfo(routeId!, itemId, await readBody(), ifMatch);
  else return { body: { error: 'Metodo non consentito.' }, status: 405 };
  return { body: result.record, etag: result.etag, status: method === 'POST' ? 201 : 200 };
}
