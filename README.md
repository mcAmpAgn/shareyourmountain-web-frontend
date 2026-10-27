# Share Your Mountain — React, Workers and D1

An Italian-first discovery application with React, a Cloudflare Workers/D1 production backend and a Node.js/SQLite local backend. The December 2017 archive imports **12,311 mountains and 3,041 routes**. Normal discovery shows **12,266 active mountains and 3,028 active routes**. See [Cloudflare deployment](docs/CLOUDFLARE.md) for database provisioning, catalog export and Access-protected online saves. R2 is deferred until uploads are needed.

## Run on Windows

Requires Node.js 22 or later. From this repository:

```powershell
npm ci
npm run db:import -- "C:\Users\DE\Downloads\mcampagn83_symcore.28122017.sql.zip"
npm run dev
```

Open **http://127.0.0.1:8787**. React and the API share one server. This delivery creates the imported database locally at `data/shareyourmountain.sqlite`; a fresh checkout needs the import command. Database files and the private source backup are not committed.

The importer supports `.sql` and `.sql.zip`. For explicit options:

```powershell
node --import tsx scripts/import-legacy.ts --source "C:\path\backup.sql.zip" --snapshot 2017-12-28
```

Reimporting the same archive is safe and does nothing. A different source is refused when catalog data exists. Use a new `DATABASE_PATH` for a different import; existing catalogs and adventures are never automatically deleted.

## Build, check and maintain

```powershell
npm test
npm run build
npm run db:backup
```

For production-mode local serving:

```powershell
$env:NODE_ENV = "production"
npm start
```

Without `NODE_ENV=production`, `npm start` uses Vite development middleware. `HOST`, `PORT`, and `DATABASE_PATH` can be set in the shell. `.env.example` documents them; `.env` files are not automatically loaded. `npm run typecheck`, `npm run format`, and `npm run db:migrate` are also available.

Backups use SQLite's consistent backup API and go to ignored `backups/`. Restore to a new database path with the app stopped, preserving the existing database first. Do not copy only an active WAL database's main file.

## Responsibilities

```text
src/client/components/      UI surfaces, cards, filters and dialogs
src/client/hooks/           Request cancellation, URL state, adventure mutations
src/client/lib/             HTTP client and presentation formatting
src/client/App.tsx          Application composition
src/core/                   Shared async catalog queries, validation and application rules
src/worker/                 Fetch routes, D1 adapters and verified Access identity
src/server/http/            Routes, input validation and local-profile boundary
src/server/services/        Application rules and detail/source assembly
src/server/repositories/    Prepared catalog queries and typed persistence
src/server/db/              Connection, Drizzle mappings and SQL migrations
src/server/import/          SQL text parser and transactional public-data import
src/shared/                 Explicit API contracts, without server dependencies
scripts/                    Migration, import and consistent-backup entry points
tests/                      Synthetic fixtures, database and HTTP integration tests
```

Components do not issue SQL or know legacy database fields. Hooks own network/navigation state. Routes validate requests before invoking services. Repositories own database access. Drizzle handles typed adventure persistence; prepared SQLite queries handle catalog joins, FTS and bulk import. SQL migrations are the canonical schema. Update typed mappings when adding a new migration; never modify an already-applied migration.

## Included

- Responsive homepage with the original branding and photography.
- Server-side Unicode/diacritic-aware token-prefix search, geography/activity/elevation filters, sorting and stable pagination.
- Database-driven activity choices, including trekking.
- Details with descriptions, source reports, historical images, related routes, parking and track links when available.
- Map links clearly distinguish route, summit and parking positions. Missing data remains missing.
- Persistent planned/completed adventures, notes, duplicate prevention and timestamps.
- Shareable detail URLs, filter query strings, loading/error/empty states and native accessible dialogs.
- Interactive homepage OpenStreetMap section: pan/zoom, summit markers, elevation filter, destination shortcuts and linked mountain details. Loads on request and retrieves at most 1,000 peaks per viewport; missing route geometry is never inferred.

FTS token-prefix search differs from arbitrary middle-of-word matching. Grades and activity classifications are historical records, not current route advice.

## Data and privacy

The importer parses source text and never executes MySQL statements. It retains 21 public source tables plus a rock identity helper: SQLite needs a unique parent for the original multilingual `(id, language)` rock records. Original catalog IDs remain stable. Legacy identity, profile/history/statistics records and author `user_id` fields are excluded.

The complete import is transactional. Invalid coordinate pairs and zero route metrics become nullable served values; the originals and reasons are stored in `import_issues`. Low historical elevations are flagged rather than silently corrected. The real import produced 3,253 audit entries. Checksums, counts, snapshot date and import time are retained in `import_batches`. Foreign-key and integrity checks validate the result.

Private accounts/wishlists, empty accommodation/translation/detail tables, old procedures and derived social/reporting views are not recreated. External historical media, report links and track files are not independently verified or downloaded by the importer.

The Node backend uses a **local development profile**, requiring loopback and localhost Host; mutations require a matching Origin. The production Worker requires verified **Cloudflare Access** sign-in and isolates each user's saves. Online saves stay disabled until Access is configured. The D1 export excludes every local profile, adventure and note. Earlier demo browser-local saves remain untouched; they are not automatically uploaded.

## API

Autocomplete: `GET /api/suggestions?q=...` returns up to six active mountain/route name matches. Optional `kind` and `activityId` filters follow the search activity choice. Queries need 2–120 characters. The homepage supports Arrow Up/Down, Enter, Escape, and pointer selection; full catalog search remains available.

| Endpoint                                            | Purpose                                         |
| --------------------------------------------------- | ----------------------------------------------- |
| `GET /api/health`, `/api/stats`, `/api/filters`     | Readiness, provenance/counts and filter choices |
| `GET /api/catalog`, `/api/mountains`, `/api/routes` | Paginated discovery                             |
| `GET /api/mountains/:id`, `/api/routes/:id`         | Detail DTOs                                     |
| `GET /api/map/mountains?bbox=west,south,east,north` | Valid active summit positions                   |
| `GET/POST /api/me/adventures`                       | Local saved targets                             |
| `PATCH/DELETE /api/me/adventures/:id`               | Notes, completion and removal                   |

Listing filters: `q`, `kind`, `activityId`, `countryId`, `regionId`, `rangeId`, `mountainId`, `minElevation`, `sort=name|elevation`, `page`, `pageSize` (maximum 50). Invalid/unknown input returns 400, unavailable records 404, and rejected local-profile access 403. Errors do not expose SQL or request bodies.

## Deployment boundary

One Node instance with a persistent local disk can host the API and SQLite later. Static hosting alone cannot run the app. Keep databases, dumps and uploads outside Git and the served directory. Multi-instance writers, public authentication, contributions/uploads, live weather and offline synchronization are separate future work.

CI installs from the lockfile, runs synthetic-fixture tests and builds React without the private archive. Its artifact includes the client build and server source. Deployment still requires dependencies, configuration and a separately imported database.

See [architecture](docs/ARCHITECTURE.md), [verification](docs/VERIFICATION.md), [legacy audit](docs/LEGACY_AUDIT.md), [original proposal](docs/MVP_DATABASE_PROPOSAL.md), and [attributions](docs/ATTRIBUTIONS.md).

## GitHub pipeline

See [CI documentation](docs/CI.md) for the Windows/Linux test matrix, dependency audit, verified runtime artifact, and production-only smoke test. Run `npm run package:release` after building to create the ignored release directory; `npm run test:release` verifies an isolated copy without using your database.

## Google sign-in for favourites

Signed-out visitors select a heart to open the sign-in prompt. Google is the preferred production login through Cloudflare Access; the selected adventure returns after login and is saved only with a matching, short-lived same-tab intent. Account logout is available in the adventures panel. Follow [Google setup](docs/GOOGLE_SIGN_IN.md) to configure the identity provider and Access policy; no credentials are committed. The Node localhost profile remains development-only.
