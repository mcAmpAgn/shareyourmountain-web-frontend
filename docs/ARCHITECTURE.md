# Architecture decisions

React renders product DTOs and collects user actions. Express validates HTTP requests. Services assemble details and enforce application rules. Repositories own prepared catalog queries and typed Drizzle adventure persistence. Only the server opens SQLite. Shared contracts import no backend implementation.

The frontend is organized by surfaces rather than by individual DOM fragments. Reusable dialogs, search, filters, cards, detail and adventure components each own their presentation. Hooks own request cancellation, URL navigation and mutations; aborted searches cannot replace newer results. App composes these surfaces without querying the database.

Development uses Vite middleware and production serves the compiled React files from the API process. Both use one origin, avoiding unnecessary CORS configuration and separate-server orchestration.

SQL migrations are versioned and checksummed. They are the canonical database schema; Drizzle mappings describe the typed application columns. Applied migrations cannot be silently edited. WAL, busy timeout and foreign-key enforcement are set when opening a connection.

The importer reads only allowlisted public tables and fields, never executes source SQL, and never imports private identity records. An entire import, including quality audit entries, commits atomically. The same checksum is idempotent; a populated catalog cannot be replaced accidentally. The source archive remains external and unchanged.

The original relational catalog is retained. Border geography remains many-to-many, route-to-mountain is optional, source reports remain linked and technical grades remain raw text. Internally retained legacy field names make the migration traceable; API contracts use clearer names such as `elevationM` and `difficultyRaw`.

MySQL allowed a mountain to reference the nonunique `id` prefix of the rock table's `(id,language)` key. SQLite requires a unique parent, so `stone_types(id)` supplies identities and `stone` retains translations. Tests cover two translations of one type.

FTS5 normalizes Unicode/diacritics and performs token-prefix searches. User input becomes literal letter/number tokens in a parameterized MATCH query, not raw SQL or FTS operators. Stable sorting includes numeric ID and entity type. Map search uses valid active mountain coordinates, a bounding box and a 1,000-record cap. Summit, route and parking positions remain distinct.

Adventures have exactly one target, profile-scoped unique target indexes, planned/completed state, notes and timestamps. Persistence is verified across reopening a real SQLite file. The local profile requires loopback and localhost Host; mutation Origin must match. This deliberately does not substitute for real authentication on a public deployment.

Runtime databases, original backups, generated backups, dependencies and build output are ignored. CI uses synthetic public fixtures. Authentication, uploads, social feeds, live weather and distributed/offline synchronization remain outside this local MVP.
