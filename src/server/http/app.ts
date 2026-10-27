import express, { type RequestHandler, type ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import type { AppDatabase } from '../db/connection.js';
import { createCatalogRepository } from '../repositories/catalog-repository.js';
import { createAdventureRepository } from '../repositories/adventure-repository.js';
import { createCatalogService } from '../services/catalog-service.js';
import { createAdventureService, ApplicationError } from '../services/adventure-service.js';
import * as validation from './validation.js';

const localProfileOnly: RequestHandler = (req, res, next) => {
  const ip = req.socket.remoteAddress,
    local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip ?? '');
  const hostname = req.hostname;
  const localHost = ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(hostname);
  if (!local || !localHost) {
    res
      .status(403)
      .json({ error: 'Il profilo di sviluppo è disponibile solo su questo computer.' });
    return;
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    try {
      const origin = new URL(req.get('origin') ?? '');
      if (origin.host !== req.get('host') || !['http:', 'https:'].includes(origin.protocol))
        throw Error();
    } catch {
      res.status(403).json({ error: 'Origine della richiesta non consentita.' });
      return;
    }
  }
  next();
};
export function createApp(db: AppDatabase) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  const repository = createCatalogRepository(db),
    catalog = createCatalogService(repository),
    adventures = createAdventureService(createAdventureRepository(db), repository);
  app.get('/api/capabilities', (_req, res) =>
    res.json({ profileMode: 'local', signInUrl: null, signInProvider: null, signOutUrl: null }),
  );
  app.get('/api/health', async (_req, res) =>
    res.json({ ok: true, initialized: (await catalog.stats()).totalMountains > 0 }),
  );
  app.get('/api/stats', async (_req, res) => res.json(await catalog.stats()));
  app.get('/api/filters', async (_req, res) => res.json(await catalog.filters()));
  app.get('/api/catalog', async (req, res) =>
    res.json(await catalog.list(validation.catalogQuery.parse(req.query))),
  );
  for (const [path, kind] of [
    ['mountains', 'mountain'],
    ['routes', 'route'],
  ] as const) {
    app.get('/api/' + path, async (req, res) => {
      const query = validation.catalogQuery.parse(req.query);
      res.json(await catalog.list({ ...query, kind }));
    });
    app.get('/api/' + path + '/:id', async (req, res) => {
      const result = await catalog.detail(kind, validation.catalogId.parse(req.params.id));
      if (!result) throw new ApplicationError(404, 'Questa scheda non è disponibile.');
      res.json(result);
    });
  }
  app.get('/api/map/mountains', async (req, res) => {
    const query = validation.mapQuery.parse(req.query);
    res.json({ items: await catalog.map(query.bbox, query.minElevation), limit: 1000 });
  });
  app.use('/api/me', localProfileOnly);
  app.get('/api/me/adventures', async (_req, res) => res.json(await adventures.list()));
  app.post('/api/me/adventures', async (req, res) =>
    res.status(201).json(await adventures.create(validation.adventureCreate.parse(req.body))),
  );
  app.patch('/api/me/adventures/:id', async (req, res) =>
    res.json(
      await adventures.update(
        validation.adventureId.parse(req.params.id),
        validation.adventureUpdate.parse(req.body),
      ),
    ),
  );
  app.delete('/api/me/adventures/:id', async (req, res) => {
    await adventures.remove(validation.adventureId.parse(req.params.id));
    res.status(204).end();
  });
  app.use('/api', async (_req, res) => res.status(404).json({ error: 'Endpoint non trovato.' }));
  return app;
}
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res
      .status(400)
      .json({ error: 'Parametri non validi.', fields: error.issues.map((i) => i.path.join('.')) });
    return;
  }
  if (error instanceof ApplicationError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Richiesta JSON non valida.' });
    return;
  }
  if (error?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Richiesta troppo grande.' });
    return;
  }
  // Deliberately do not log SQL, request bodies or raw database error objects.
  console.error('Request failed:', error instanceof Error ? error.name : 'UnknownError');
  res.status(500).json({ error: 'Impossibile completare la richiesta. Riprova.' });
};
