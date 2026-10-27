# Architecture decisions

React renders product DTOs and collects user actions. Express (local) and Fetch routes (Workers) validate HTTP requests. `src/core` holds shared asynchronous catalog queries, validation and application rules behind a small SQL port. Runtime adapters implement that port with better-sqlite3 or D1. Drizzle adventure repositories implement the same persistence contract for each runtime. Shared API contracts import no backend implementation.

The frontend is organized by surfaces rather than by individual DOM fragments. Reusable dialogs, search, filters, cards, detail and adventure components each own their presentation. Hooks own request cancellation, URL navigation and mutations; aborted searches cannot replace newer results. App composes these surfaces without querying the database.

Local development uses Vite middleware. Node production mode serves compiled React from Express; Cloudflare production serves static assets from the Worker with D1 bindings. Both use one origin. The Worker bundle does not import the native SQLite driver or Node server. D1 has its own ordered migrations; local SQLite migration checksums remain unchanged.

SQL migrations are versioned and checksummed. They are the canonical database schema; Drizzle mappings describe the typed application columns. Applied migrations cannot be silently edited. WAL, busy timeout and foreign-key enforcement are set when opening a connection.

The importer reads only allowlisted public tables and fields, never executes source SQL, and never imports private identity records. An entire import, including quality audit entries, commits atomically. The same checksum is idempotent; a populated catalog cannot be replaced accidentally. The source archive remains external and unchanged.

The original relational catalog is retained. Border geography remains many-to-many, route-to-mountain is optional, source reports remain linked and technical grades remain raw text. Internally retained legacy field names make the migration traceable; API contracts use clearer names such as `elevationM` and `difficultyRaw`.

MySQL allowed a mountain to reference the nonunique `id` prefix of the rock table's `(id,language)` key. SQLite requires a unique parent, so `stone_types(id)` supplies identities and `stone` retains translations. Tests cover two translations of one type.

FTS5 normalizes Unicode/diacritics and performs token-prefix searches. User input becomes literal letter/number tokens in a parameterized MATCH query, not raw SQL or FTS operators. Stable sorting includes numeric ID and entity type. Map search uses valid active mountain coordinates, a bounding box and a 1,000-record cap. Summit, route and parking positions remain distinct.

Adventures have exactly one target, profile-scoped unique target indexes, planned/completed state, notes and timestamps. Persistence is verified across reopening a real SQLite file. The local profile requires loopback and localhost Host; mutation Origin must match. This deliberately does not substitute for real authentication on a public deployment.

Workers validate Access JWT signatures, issuer, audience, expiry and subject, derive a profile from the verified issuer/subject, and scope every personal query to it. Online saves are disabled without Access configuration. Same-origin mutations and bounded JSON bodies protect the API boundary. The public catalog never selects a local development profile. The D1 seed allowlists public data, batches statements within size limits, rebuilds FTS and rejects replay through an import marker.

Runtime databases, original backups, generated exports, dependencies and build output are ignored. CI uses synthetic public fixtures and runs the compiled Worker against real local D1, including signed-token verification and two-user isolation. Uploads, social feeds, live weather and distributed/offline synchronization remain outside this MVP. See [Cloudflare setup](CLOUDFLARE.md).

The homepage map separates section controls/data fetching (MapSection) from Leaflet lifecycle and markers (MountainMap). Leaflet and its stylesheet load only after the visitor opens the map. Viewport changes are debounced; requests use the existing abortable resource hook and bounded public mountain endpoint. Markers represent summit positions, never inferred route starts. Popup names use DOM text nodes. An accessible companion list opens the same details. Default OSM tiles load directly in the browser with attribution, normal caching and no offline prefetch; build-time VITE_MAP_TILE_URL and VITE_MAP_ATTRIBUTION support another provider.
