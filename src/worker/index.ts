import { ZodError } from 'zod';
import type { WorkerEnv } from './bindings.js';
import { createCatalogRepository } from '../core/catalog-repository.js';
import { createCatalogService } from '../core/catalog-service.js';
import { createAdventureService, ApplicationError } from '../core/adventure-service.js';
import { d1Queries } from './d1-adapter.js';
import { createD1AdventureRepository } from './adventure-repository.js';
import { accessConfigured, verifyAccessIdentity } from './access.js';
import * as validation from '../core/validation.js';

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  });
}
function sameOrigin(request: Request) {
  const origin = request.headers.get('Origin');
  if (!origin || origin !== new URL(request.url).origin)
    throw new ApplicationError(403, 'Origine della richiesta non consentita.');
}
async function readJSON(request: Request) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))
    throw new ApplicationError(415, 'È richiesta una richiesta JSON.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApplicationError(400, 'Richiesta JSON non valida.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        throw new ApplicationError(413, 'Richiesta troppo grande.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApplicationError(400, 'Richiesta JSON non valida.');
  }
}
type IdentityVerifier = typeof verifyAccessIdentity;
export function createWorker(verifyIdentity: IdentityVerifier = verifyAccessIdentity) {
  return {
    async fetch(request: Request, env: WorkerEnv): Promise<Response> {
      const url = new URL(request.url),
        path = url.pathname,
        method = request.method;
      if (!path.startsWith('/api/') && path !== '/api')
        return env.ASSETS.fetch(request.url, { method: request.method, headers: request.headers });
      try {
        if (method === 'GET' && path === '/api/capabilities')
          return json({
            profileMode: accessConfigured(env) ? 'access' : 'disabled',
            signInUrl: accessConfigured(env) ? '/api/me/login' : null,
            signInProvider: accessConfigured(env)
              ? env.ACCESS_LOGIN_PROVIDER === 'google'
                ? 'google'
                : 'access'
              : null,
            signOutUrl: accessConfigured(env) ? '/cdn-cgi/access/logout' : null,
          });
        if (!env.DB) throw new ApplicationError(503, 'Il database non è configurato.');
        const repository = createCatalogRepository(d1Queries(env.DB)),
          catalog = createCatalogService(repository);
        const query = Object.fromEntries(url.searchParams);
        if ([...url.searchParams.keys()].some((key) => url.searchParams.getAll(key).length > 1))
          throw new ApplicationError(400, 'Parametri duplicati non validi.');
        if (method === 'GET' && path === '/api/health')
          return json({ ok: true, initialized: (await catalog.stats()).totalMountains > 0 });
        if (method === 'GET' && path === '/api/stats') return json(await catalog.stats());
        if (method === 'GET' && path === '/api/filters') return json(await catalog.filters());
        if (method === 'GET' && path === '/api/suggestions')
          return json(await catalog.suggestions(validation.suggestionQuery.parse(query)));
        if (method === 'GET' && ['/api/catalog', '/api/mountains', '/api/routes'].includes(path)) {
          const input = validation.catalogQuery.parse(query);
          return json(
            await catalog.list({
              ...input,
              ...(path === '/api/mountains'
                ? { kind: 'mountain' as const }
                : path === '/api/routes'
                  ? { kind: 'route' as const }
                  : {}),
            }),
          );
        }
        const detail = path.match(/^\/api\/(mountains|routes)\/([^/]+)$/);
        if (method === 'GET' && detail) {
          const item = await catalog.detail(
            detail[1] === 'mountains' ? 'mountain' : 'route',
            validation.catalogId.parse(detail[2]),
          );
          if (!item) throw new ApplicationError(404, 'Questa scheda non è disponibile.');
          return json(item);
        }
        if (method === 'GET' && path === '/api/map/mountains') {
          const input = validation.mapQuery.parse(query);
          return json({ items: await catalog.map(input.bbox, input.minElevation), limit: 1000 });
        }
        if (path.startsWith('/api/me/')) {
          if (!['GET', 'HEAD'].includes(method)) sameOrigin(request);
          const profileId = await verifyIdentity(request, env);
          if (path === '/api/me/login' && method === 'GET') {
            const input = validation.signInQuery.parse(query);
            const hash =
              input.kind && input.targetId
                ? `#detail=${input.kind === 'mountain' ? 'm' : 'r'}-${input.targetId}`
                : '#adventures';
            return new Response(null, {
              status: 303,
              headers: {
                Location:
                  url.origin + '/' + (input.resume === '1' ? '?resumeFavorite=1' : '') + hash,
                'Cache-Control': 'no-store',
              },
            });
          }
          const isList = path === '/api/me/adventures',
            target = path.match(/^\/api\/me\/adventures\/([^/]+)$/);
          if (!isList && !target) throw new ApplicationError(404, 'Endpoint non trovato.');
          await env.DB.prepare('INSERT OR IGNORE INTO app_profiles(id,display_name) VALUES (?,?)')
            .bind(profileId, 'Il mio profilo')
            .run();
          const adventures = createAdventureService(
            createD1AdventureRepository(env.DB, profileId),
            repository,
          );
          if (isList && method === 'GET') return json(await adventures.list());
          if (isList && method === 'POST')
            return json(
              await adventures.create(validation.adventureCreate.parse(await readJSON(request))),
              201,
            );
          if (target && method === 'PATCH')
            return json(
              await adventures.update(
                validation.adventureId.parse(target[1]),
                validation.adventureUpdate.parse(await readJSON(request)),
              ),
            );
          if (target && method === 'DELETE') {
            await adventures.remove(validation.adventureId.parse(target[1]));
            return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
          }
          return json({ error: 'Metodo non consentito.' }, 405);
        }
        return json({ error: 'Endpoint non trovato.' }, 404);
      } catch (error) {
        if (error instanceof ZodError)
          return json(
            {
              error: 'Parametri non validi.',
              fields: error.issues.map((issue) => issue.path.join('.')),
            },
            400,
          );
        if (error instanceof ApplicationError) return json({ error: error.message }, error.status);
        console.error(
          'Worker request failed:',
          error instanceof Error ? error.name : 'UnknownError',
        );
        return json(
          {
            error: 'Servizio non disponibile. Controlla configurazione e migrazioni del database.',
          },
          503,
        );
      }
    },
  };
}
export default createWorker();
