# GitHub Actions pipeline

The `CI` workflow runs on pushes, pull requests and manual dispatch. New runs cancel superseded runs on the same ref. Every job has a timeout and the workflow requests only read access to repository content. Checkout does not retain credentials. Official actions are pinned to immutable commit SHAs; Dependabot proposes weekly action and npm dependency updates.

## Gates

1. Formatting, strict TypeScript checking and database/HTTP tests. The test matrix covers Windows with Node 22 and Linux with Node 22 and 24, including the native SQLite driver. Formatting runs once on Linux/22.
2. Runtime dependency audit, blocking high and critical advisories.
3. Worker compilation, local D1 migrations/import, full-text search, Access JWT validation, cross-origin rejection and two-user isolation. No Cloudflare credentials are needed. Pushes upload a compiled Cloudflare artifact.
4. Production Node build and release smoke test, after verification, audit and Worker jobs pass: copy the package to an isolated temporary directory, verify its file checksums, install **production dependencies only**, create a synthetic SQLite fixture, start the actual production server, and check readiness, React assets, catalog API and a database-backed adventure write. The test server and temporary files are removed afterward.

The production test does not read the real database or private backup. Pull requests execute the same build/smoke gates, but upload no artifact. Pushes and manual runs upload the verified package under a commit-specific name with 14-day retention. This workflow does not deploy anything.

## Artifact contract

`npm run package:release` assembles `release/` from a small explicit allowlist: built React files, core/backend/shared source, the migration/import/backup scripts, locked package manifests, TypeScript configuration, README, license and `.env.example`. The manifest records the GitHub commit and SHA-256 of each packaged file.

Databases, original archives, secrets, dependency directories, local uploads and backups are rejected. Symlinks are rejected. The upload includes hidden files only because the allowlist deliberately includes `.env.example`; no working directory is uploaded wholesale. The smoke test installs into a separate temporary copy, so the uploaded artifact never includes its `node_modules` or synthetic database.

After extracting the artifact, run `npm ci --omit=dev`, configure `NODE_ENV=production` and an external `DATABASE_PATH`, import the authorized catalog with `npm run db:import -- /path/to/backup.sql.zip`, then run `npm start`. Development, test, formatting and rebuild commands require a full source checkout, not this runtime artifact. The existing local-profile access restriction remains unchanged.

## Reproduce locally

```text
npm ci
npm run format:check
npm run typecheck
npm test
npm run build
npm run package:release
npm run test:release
```

The release smoke test needs network access for its isolated production-only install and permission to open a loopback port. `release/` is generated and ignored by Git. Native SQLite binaries are installed independently for each runner; only npm's download cache is reused, never `node_modules`.

## Official action references

- https://github.com/actions/checkout/releases/tag/v7.0.1
- https://github.com/actions/setup-node/releases/tag/v7.1.0
- https://github.com/actions/upload-artifact/releases/tag/v7.0.2

## Cloudflare artifact

The separate ignored release-cloudflare/ package contains the compiled Worker, React assets, D1 migrations, rewritten deployment config and SHA-256 file manifest. It excludes native SQLite, catalog exports and personal data. See [Cloudflare deployment](CLOUDFLARE.md) for account, database and Access setup. No CI job publishes to Cloudflare.
