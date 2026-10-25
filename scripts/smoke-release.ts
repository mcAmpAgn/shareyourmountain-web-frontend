import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdtemp, rm, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fixtureDatabase } from '../tests/fixtures.js';

const temp = await mkdtemp(path.join(tmpdir(), 'sym-release-'));
const app = path.join(temp, 'app');
let server: ReturnType<typeof spawn> | undefined;
async function run(command: string, args: string[], cwd: string) {
  const child = spawn(command, args, { cwd, stdio: 'inherit', env: process.env });
  const [code] = await once(child, 'exit');
  if (code !== 0) throw new Error('Release dependency install failed');
}
try {
  await cp('release', app, { recursive: true });
  const manifest = JSON.parse(await readFile(path.join(app, 'release-manifest.json'), 'utf8')) as {
    files: { path: string; sha256: string }[];
  };
  for (const file of manifest.files)
    assert.equal(
      createHash('sha256')
        .update(await readFile(path.join(app, file.path)))
        .digest('hex'),
      file.sha256,
      `Checksum mismatch: ${file.path}`,
    );
  if (!process.env.npm_execpath) throw new Error('Run this check with npm run test:release');
  await run(
    process.execPath,
    [process.env.npm_execpath, 'ci', '--omit=dev', '--no-audit', '--no-fund'],
    app,
  );
  const databasePath = path.join(temp, 'smoke.sqlite');
  const db = fixtureDatabase(databasePath);
  db.sqlite.close();
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = (probe.address() as { port: number }).port;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  const base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['--import', 'tsx', 'src/server/index.ts'], {
    cwd: app,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: String(port),
      DATABASE_PATH: databasePath,
    },
  });
  let output = '';
  server.stdout?.on('data', (chunk) => (output += chunk));
  server.stderr?.on('data', (chunk) => (output += chunk));
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null)
      throw new Error('Packaged server exited before readiness: ' + output);
    try {
      const response = await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        assert.equal((await response.json()).initialized, true);
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'Packaged application did not become ready');
  const html = await fetch(base).then((r) => {
    assert.equal(r.status, 200);
    return r.text();
  });
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(
    assets.some((a) => a.endsWith('.js')),
    'Built React entry is missing',
  );
  for (const asset of assets) assert.equal((await fetch(base + asset)).status, 200, asset);
  assert.equal((await fetch(base + '/api/catalog?kind=route').then((r) => r.json())).total, 2);
  const saved = await fetch(base + '/api/me/adventures', {
    method: 'POST',
    headers: { Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'mountain', targetId: 10 }),
  }).then((r) => {
    assert.equal(r.status, 201);
    return r.json();
  });
  assert.ok(saved.id);
  console.log(
    'Verified package: production-only install, migration compatibility, React assets, API and SQLite writes.',
  );
} finally {
  if (server && server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill();
    await exited;
  }
  await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
