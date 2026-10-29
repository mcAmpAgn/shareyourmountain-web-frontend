import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { Miniflare, convertV4MiniflareOptions, Response as MiniflareResponse } from 'miniflare';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { fixtureDatabase } from '../fixtures.js';
import { exportD1Catalog, sqlValue } from '../../scripts/d1-export.js';
import { sqlStatements } from '../../scripts/sql-statements.js';

test('Worker bundle runs against real local D1, enforces Access identities and imports only public catalog data', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'fixture-key', alg: 'RS256' };
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      bindings: {
        ACCESS_TEAM_DOMAIN: 'https://fixture.cloudflareaccess.com',
        ACCESS_AUD: 'fixture-audience',
        ACCESS_LOGIN_PROVIDER: 'google',
      },
      outboundService: async (request) =>
        new MiniflareResponse(
          request.url === 'https://fixture.cloudflareaccess.com/cdn-cgi/access/certs'
            ? JSON.stringify({ keys: [jwk] })
            : 'Not found',
          {
            status:
              request.url === 'https://fixture.cloudflareaccess.com/cdn-cgi/access/certs'
                ? 200
                : 404,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      modules: true,
      scriptPath: path.resolve('dist/worker/index.js'),
      compatibilityDate: '2026-10-26',
      d1Databases: ['DB'],
      assets: {
        directory: path.resolve('dist/client'),
        binding: 'ASSETS',
        routerConfig: { has_user_worker: true },
        run_worker_first: ['/api/*', '/api'],
        assetConfig: { not_found_handling: 'single-page-application' },
      },
    }),
  );
  const source = fixtureDatabase();
  try {
    source.sqlite
      .prepare("INSERT INTO app_profiles VALUES ('private-owner','DO_NOT_EXPORT_PROFILE')")
      .run();
    source.sqlite
      .prepare(
        "INSERT INTO adventures VALUES ('private-adventure','private-owner',10,NULL,'planned',NULL,'DO_NOT_EXPORT_NOTES','now','now')",
      )
      .run();
    const exported = exportD1Catalog(source.sqlite);
    assert.ok(!exported.sql.includes('DO_NOT_EXPORT'));
    assert.ok(!exported.sql.includes('INSERT INTO "app_profiles"'));
    assert.ok(!exported.sql.includes('INSERT INTO "adventures"'));
    assert.ok(!exported.sql.includes('catalog_search_data'));
    assert.equal(sqlValue("a'b"), "'a''b'");
    const binding = await mf.getD1Database('DB');
    for (const file of (await readdir('d1/migrations')).filter((f) => f.endsWith('.sql')).sort()) {
      const statements = sqlStatements(await readFile(path.join('d1/migrations', file), 'utf8'));
      await binding.batch(statements.map((s) => binding.prepare(s)));
    }
    await binding.batch(sqlStatements(exported.sql).map((s) => binding.prepare(s)));
    const totals = await binding
      .prepare(
        'SELECT mountains,routes,total_mountains,total_routes FROM catalog_totals WHERE id=1',
      )
      .all();
    assert.deepEqual(totals.results, [
      { mountains: 2, routes: 2, total_mountains: 3, total_routes: 3 },
    ]);
    // D1 reports rows read, rather than elapsed time or the number of output columns.
    assert.ok(totals.meta.rows_read <= 2, JSON.stringify(totals.meta));
    const stats = await mf.dispatchFetch('https://example.test/api/stats');
    assert.equal(((await stats.json()) as { mountains: number }).mountains, 2);
    const response = await mf.dispatchFetch('https://example.test/api/health');
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(((await response.json()) as { initialized: boolean }).initialized, true);
    const listed = await mf.dispatchFetch('https://example.test/api/catalog?q=Tasch');
    assert.equal(
      (
        (await mf
          .dispatchFetch('https://example.test/api/mountains/10/photos?provider=instagram')
          .then((response) => response.json())) as { status: string }
      ).status,
      'not_configured',
    );
    assert.equal(
      (await mf.dispatchFetch('https://example.test/api/mountains/999/photos')).status,
      404,
    );
    assert.equal(
      (await mf.dispatchFetch('https://example.test/api/mountains/10/photos?provider=invalid'))
        .status,
      400,
    );
    assert.equal(((await listed.json()) as { total: number }).total, 1);
    const suggestions = (await mf
      .dispatchFetch('https://example.test/api/suggestions?q=Cerv')
      .then((r) => r.json())) as { items: { key: string }[] };
    assert.deepEqual(
      suggestions.items.map((item) => item.key),
      ['m-10', 'r-2'],
    );
    assert.equal((await mf.dispatchFetch('https://example.test/api/suggestions?q=C')).status, 400);
    const route = (await mf
      .dispatchFetch('https://example.test/api/routes/2')
      .then((r) => r.json())) as { latitude: unknown; mountainLocation: unknown };
    assert.equal(route.latitude, null);
    assert.ok(route.mountainLocation);
    assert.equal((await mf.dispatchFetch('https://example.test/api/catalog?page=-1')).status, 400);
    assert.equal(
      (await mf.dispatchFetch('https://example.test/api/catalog?page=1&page=2')).status,
      400,
    );
    const missing = await mf.dispatchFetch('https://example.test/api/not-found');
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get('Content-Type') ?? '', /json/);
    assert.equal(
      (
        await mf.dispatchFetch('https://example.test/api/me/adventures', {
          headers: { 'Cf-Access-Jwt-Assertion': 'forged' },
        })
      ).status,
      401,
    );
    assert.equal(
      (await binding.prepare('SELECT count(*) n FROM app_profiles').first<{ n: number }>())?.n,
      0,
    );
    const homepage = await mf.dispatchFetch('https://example.test/');
    assert.equal(homepage.status, 200);
    assert.match(await homepage.text(), /\/assets\/index-.*\.js/);
    await assert.rejects(() =>
      binding.batch(sqlStatements(exported.sql).map((s) => binding.prepare(s))),
    );
    assert.equal(
      (await binding.prepare('SELECT count(*) n FROM mountain').first<{ n: number }>())?.n,
      3,
    );

    const token = (sub: string, aud = 'fixture-audience', expiration = '2m') =>
      new SignJWT({ sub })
        .setProtectedHeader({ alg: 'RS256', kid: 'fixture-key' })
        .setIssuer('https://fixture.cloudflareaccess.com')
        .setAudience(aud)
        .setIssuedAt()
        .setExpirationTime(expiration)
        .sign(privateKey);
    const alice = await token('alice'),
      bob = await token('bob');
    const call = (
      url: string,
      jwt: string,
      method = 'GET',
      body?: unknown,
      origin = 'https://example.test',
    ) =>
      mf.dispatchFetch('https://example.test' + url, {
        redirect: 'manual',
        method,
        headers: {
          'Cf-Access-Jwt-Assertion': jwt,
          Origin: origin,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    assert.equal((await call('/api/me/adventures', 'forged')).status, 401);
    assert.equal(
      (await call('/api/me/adventures', await token('alice', 'other-audience'))).status,
      401,
    );
    assert.equal(
      (await call('/api/me/adventures', await token('alice', 'fixture-audience', '-1m'))).status,
      401,
    );
    assert.equal(
      (
        await call(
          '/api/me/adventures',
          alice,
          'POST',
          { kind: 'mountain', targetId: 10 },
          'https://evil.test',
        )
      ).status,
      403,
    );
    const saved = (await call('/api/me/adventures', alice, 'POST', {
      kind: 'mountain',
      targetId: 10,
    }).then((r) => r.json())) as { id: string };
    assert.ok(saved.id);
    const repeated = (await call('/api/me/adventures', alice, 'POST', {
      kind: 'mountain',
      targetId: 10,
    }).then((r) => r.json())) as { id: string };
    assert.equal(repeated.id, saved.id);
    assert.equal(
      ((await call('/api/me/adventures', bob).then((r) => r.json())) as unknown[]).length,
      0,
    );
    assert.equal(
      (await call('/api/me/adventures/' + saved.id, bob, 'PATCH', { notes: 'not mine' })).status,
      404,
    );
    assert.equal((await call('/api/me/adventures/' + saved.id, bob, 'DELETE')).status, 404);
    const updated = (await call('/api/me/adventures/' + saved.id, alice, 'PATCH', {
      status: 'completed',
      notes: 'My own note',
    }).then((r) => r.json())) as { status: string };
    assert.equal(updated.status, 'completed');
    assert.equal(
      (
        await call('/api/me/adventures', alice, 'POST', {
          kind: 'mountain',
          targetId: 10,
          profileId: 'bob',
        })
      ).status,
      400,
    );
    assert.equal((await call('/api/me/adventures/' + saved.id, alice, 'DELETE')).status, 204);
    assert.equal(
      ((await call('/api/me/adventures', alice).then((r) => r.json())) as unknown[]).length,
      0,
    );
    assert.equal((await call('/api/me/login', alice)).status, 303);
    const capabilities = (await mf
      .dispatchFetch('https://example.test/api/capabilities')
      .then((r) => r.json())) as { signInProvider: string; signOutUrl: string };
    assert.equal(capabilities.signInProvider, 'google');
    assert.equal(capabilities.signOutUrl, '/cdn-cgi/access/logout');
    const returned = await call('/api/me/login?kind=mountain&targetId=10&resume=1', alice);
    assert.equal(returned.status, 303);
    assert.equal(
      returned.headers.get('Location'),
      'https://example.test/?resumeFavorite=1#detail=m-10',
    );
    assert.equal(returned.headers.get('Cache-Control'), 'no-store');
    assert.equal((await call('/api/me/login?returnTo=https://evil.test', alice)).status, 400);
    assert.equal((await call('/api/me/login?kind=route', alice)).status, 400);
    assert.equal((await call('/api/me/login?resume=1', alice)).status, 400);
    assert.equal((await call('/api/me/login?kind=mountain&targetId=-1', alice)).status, 400);
  } finally {
    source.sqlite.close();
    await mf.dispose();
  }
});
