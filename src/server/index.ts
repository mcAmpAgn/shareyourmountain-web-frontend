import express from 'express';
import path from 'node:path';
import { loadConfig } from './config.js';
import { openDatabase, migrate } from './db/connection.js';
import { createApp, errorHandler } from './http/app.js';
const config = loadConfig(),
  db = openDatabase(config.databasePath);
migrate(db);
const app = createApp(db);
let vite: Awaited<ReturnType<(typeof import('vite'))['createServer']>> | undefined;
if (config.production) {
  app.use(express.static(path.resolve('dist/client')));
  app.use((req, res) => {
    if (req.method === 'GET' && !path.extname(req.path))
      res.sendFile(path.resolve('dist/client/index.html'));
    else res.sendStatus(404);
  });
} else {
  const { createServer } = await import('vite');
  vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}
app.use(errorHandler);
const server = app.listen(config.port, config.host, () =>
  console.log(`Share Your Mountain: http://${config.host}:${config.port}`),
);
server.on('error', () => {
  console.error('Unable to start the server. Check HOST and PORT.');
  db.sqlite.close();
  process.exitCode = 1;
  void vite?.close();
});
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  server.close(() => {
    db.sqlite.close();
    void vite?.close().then(() => process.exit(0));
    if (!vite) process.exit(0);
  });
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
