# Cloudflare deployment

Production uses one Worker for the API and built React assets, with D1 for the catalog and adventures. Local Node/SQLite development remains supported. Uploads and R2 are deferred.

## Provision and import

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
