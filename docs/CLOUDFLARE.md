# Cloudflare deployment

Production uses one Worker for the API and built React assets, with D1 for the catalog and adventures. Local Node/SQLite development remains supported. Uploads and R2 are deferred.

## Provision and import

The repository now points to the existing production `shareyourmountain-catalog` database. For that account, use the configured `DB` binding; do not create another database or replay the initial seed. The production schema and December 2017 public catalog have already been imported.

Use Node 22 or later and an authenticated Cloudflare account:

```powershell
npm ci
npx wrangler login
npx wrangler d1 create shareyourmountain-catalog --binding DB --update-config
```

Confirm that `wrangler.jsonc` contains the returned `database_id` for the `DB` binding. Commit that non-secret identifier. Never invent an ID or reuse a database containing another application's data.

```powershell
npm run d1:migrate:remote
npm run d1:export
npx wrangler d1 execute DB --remote --file d1/exports/catalog.sql
```

Export reads the already-imported local SQLite database (`DATABASE_PATH`, default `data/shareyourmountain.sqlite`). If necessary, first run the legacy import described in the README. It exports allowlisted public catalog tables, reconstructs full-text search and preserves import provenance. Legacy accounts, author identities, local profiles, saved adventures and notes are excluded. The December 2017 catalog contains 12,311 mountains and 3,041 routes, with 15,294 active catalog items.

The seed is intended for a fresh database after migrations. A unique import marker prevents accidental replay or replacement. It does not delete or overwrite personal data. If a remote import is interrupted, inspect D1's reported transaction result and import marker before retrying; do not reset an existing production database. The SQL export is ignored by Git and omitted from release artifacts.

## Require Access for online saves

The public catalog works without Access. Online saves remain disabled until both Access settings are configured. The local development profile is never used by the Worker.

1. Add a custom domain to the Worker. In Cloudflare Zero Trust, create a self-hosted Access application covering that domain's **`/api/me/*`** path. This includes `/api/me/login` and every personal API endpoint. Keep the catalog and static assets public.
2. Configure an Allow policy for your intended users and an identity provider or one-time PIN. Do not add a Bypass policy for personal endpoints.
3. Copy the Access team domain (for example `your-team.cloudflareaccess.com`) and the application's AUD tag. Add Worker environment variables `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`. These identifiers are not API tokens. Set them in the Cloudflare dashboard or the `vars` section of `wrangler.jsonc` before deployment.
4. Open the site and select the sign-in link in saved adventures. Access challenges the browser at `/api/me/login`; the Worker verifies the token and returns to the catalog.

The Worker verifies the Access JWT's signature against the team's published keys, issuer, audience, expiration and subject. A hashed issuer/subject pair identifies each profile. Email headers cannot select a profile. Mutations require a matching Origin, and every adventure query is scoped to the authenticated profile. No JWTs or email addresses are persisted. Test Cloudflare Access and its policies on the real domain before sharing online saves.

Path-scoped Access on a custom domain is the intended public/private split. Protect a workers.dev preview as a whole if needed; do not assume it has the same path configuration as the custom domain.

## Build and publish

```powershell
npm run build:worker
npm run test:worker
npm run package:worker
npm run deploy
```

`wrangler.jsonc` explicitly identifies the Worker entry point and `dist/client` asset directory. Wrangler runs `npm run build` before deployment. In Workers Builds connected to GitHub, use `npm run deploy` as the deploy command; an additional dashboard build command is unnecessary. Select the correct repository root and branch. D1 migrations and initial catalog import are deliberate setup steps; builds never import the private backup or replace the catalog.

GitHub CI compiles and tests Workers/D1 without a Cloudflare account, then uploads a separate `shareyourmountain-cloudflare-<commit>` artifact. It includes compiled Worker code, client assets, migrations, deployment config and checksums. Add the real database ID and Access settings to its config before publishing with `npx wrangler deploy --config wrangler.jsonc`. CI does not deploy or require Cloudflare credentials.

## Local development

`npm run dev` continues to serve the Node/SQLite application on port 8787 with its loopback-only local profile. To exercise the Worker:

```powershell
npm run d1:migrate:local
npm run d1:export
npx wrangler d1 execute DB --local --file d1/exports/catalog.sql
npm run dev:worker -- --port 8789
```

Run the local seed once. Local D1 is separate from the Node database and from remote D1. `.dev.vars.example` documents optional local Access identifiers; copying it to `.dev.vars` does not bypass token verification or create a shared profile. Automated tests provide synthetic signed tokens and intercept the test team's key endpoint inside the local Worker runtime.

## References

- [Workers static assets](https://developers.cloudflare.com/workers/static-assets/)
- [D1 import and export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Validating Access JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)

## Troubleshooting an empty database

If the dashboard shows zero application tables and catalog endpoints return 503, the database has been created but not initialised. Confirm the Worker DB binding and database_id refer to the same intended database. Apply the remote migrations, then import the generated public catalog once. An empty database is separate from the populated local SQLite or local D1 database; deployment alone does not copy either one.

After setup, check /api/health, /api/stats and a catalog search on the live domain. For the December 2017 snapshot, the stored totals are 12,311 mountains and 3,041 routes; public discovery includes 12,266 active mountains and 3,028 active routes. Inspect the seed marker before retrying an interrupted import and preserve existing personal data.

## D1 daily read quota

On the Free plan, Cloudflare blocks queries after the account reaches its daily row-read allowance. Error 7500 is a quota failure, not evidence of missing tables or lost data. The allowance resets at midnight UTC (01:00 Berlin in winter, 02:00 in summer). Reimporting or redeploying does not reset the allowance. Billing changes require the account owner's decision.

The catalog now counts and filters lightweight mountain/route candidates before loading card joins. Autocomplete skips a total-count query. Region/country filters use set membership rather than repeated correlated scans; readiness reads one mountain row. Applied migrations remain unchanged.

Workers cache successful public JSON reads only: stats/filters for one hour, lists/details for five minutes, map data for two minutes, and suggestions for one minute. The browser freshness window is capped at one minute. Edge Cache API availability depends on the deployment environment; a bounded isolate cache (64 entries, 8 MiB, maximum 512 KiB per entry) provides a fallback and coalesces concurrent identical requests. Keys preserve all query parameters, are separated by database in isolate memory, and use a versioned edge namespace. Invalidate that namespace when changing catalog response contracts; catalog import changes otherwise appear after TTL expiry.

Personal APIs, sign-in/capability responses, mutations, redirects, cookies and errors are never cached. Quota failures return a safe 503 response with D1_DAILY_LIMIT, retryAt and Retry-After, without exposing SQL or account details. Cache tests cover isolation, expiry, concurrent requests and private/error exclusion.

A read-only comparison against the full December 2017 catalog preserved stats, filters, listing, search, suggestion and map results. Approximate SQLite VM work fell from 61,173,000 to 130,000 steps for filters, 930,000 to 45,000 for stats, and 1,937,000 to 557,000 for suggestions. These are local execution-step estimates, not measured production D1 billable row counts. Verify live D1 usage after deployment; this does not guarantee the Free tier can support arbitrary traffic.
