# Source and route-reference editing API

References belong in `source` and `route_webinfo`; route descriptions contain original, self-contained prose without embedded provenance lists. This API adds and edits existing database entities without importing or replacing the catalog. No edit form or deletion endpoint is included.

## Endpoints

All paths below start with `/api/editor`. Production requires the same **dedicated editor Access application** and `ACCESS_EDITOR_AUD` described in [ROUTE_EDIT_API.md](ROUTE_EDIT_API.md); ordinary favourites sign-in cannot edit references. Local Node access stays loopback-only. POST/PATCH require a same-origin Origin header, JSON and the existing 16 KB body limit. Responses use `Cache-Control: no-store`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/sources?q=CAI&after=0` | Source name prefix search; up to 50 items |
| POST | `/sources` | Add a source; returns 201, its ID and ETag |
| GET | `/sources/:sourceId` | Read the source and ETag |
| PATCH | `/sources/:sourceId` | Edit supplied source fields using If-Match |
| GET | `/routes/:routeId/webinfo?after=0` | List the route's references |
| POST | `/routes/:routeId/webinfo` | Add a reference; returns 201, its ID and ETag |
| GET | `/routes/:routeId/webinfo/:webinfoId` | Read a reference and ETag |
| PATCH | `/routes/:routeId/webinfo/:webinfoId` | Edit supplied reference fields using If-Match |

Lists return `{ "items": [], "nextAfter": null }`. When nextAfter is an ID, pass it as after for the next page. Source q is a literal name prefix, not a SQL wildcard. Route IDs must identify active routes. References cannot be read or edited through another route ID.

Source fields: `name` (required for create, max 250), `url` and `logo` (nullable absolute HTTP(S) URLs, max 2048). Editing a source changes its shared identity for every linked route; changing its base URL also affects legacy relative links. Check its consumers before doing so. Dates and IDs are read-only.

Reference fields: `url` (required on create, absolute HTTP(S)), `sourceId` (existing source ID or null), `summary` (max 4000 or null), `rate` (literal source rating, max 100 or null), `languageCode` (e.g. it, en, fr or null). Optional create fields default to null. PATCH preserves omitted fields; null clears nullable values. New URLs reject credentials, javascript/data schemes and relative URLs. URLs are stored as links and never fetched by the editor. Existing relative URLs remain unchanged for metadata-only edits; reassigning their source requires an explicit absolute URL so their meaning is preserved.

PATCH requires the exact ETag from the latest item GET, including quotes. A conditional update compares the editable snapshot in the database, so racing writers receive 412 instead of silently overwriting one another. Missing If-Match returns 428. Unknown fields/invalid references return 400, missing entities 404, unsupported methods 405, duplicate source URL or same route URL on create 409. POST is not a general idempotency mechanism: read existing records before adding them. PATCH may intentionally reuse a URL; creation duplicate checks compare stored absolute URLs, not canonical equivalence of legacy relative paths. Private reads are fresh; public catalog responses can remain cached for up to five minutes.

## JSON examples

POST `/api/editor/sources`:

```json
{
  "name": "CAI Seregno",
  "url": "https://www.caiseregno.it/"
}
```

POST `/api/editor/routes/10/webinfo` (replace sourceId with the returned source ID):

```json
{
  "sourceId": 28,
  "url": "https://www.caiseregno.it/relazione/corma-di-machaby-diretta-al-banano",
  "summary": "Relazione della via, con avvicinamento e discesa.",
  "rate": "5c; 5a e A0",
  "languageCode": "it"
}
```

PATCH `/api/editor/routes/10/webinfo/:webinfoId`, headers Content-Type application/json and If-Match with that reference's ETag:

```json
{
  "summary": "Relazione e informazioni tecniche del percorso.",
  "languageCode": "it"
}
```

The browser supplies Origin on same-origin mutations. Command-line clients must send it explicitly, e.g. `http://127.0.0.1:8787` locally. A route's ETag, a source's ETag and a reference's ETag are separate versions.

## Migration and deployment

Local Node applies `005_reference_editor.sql` on startup. D1 uses the equivalent `0006_reference_editor.sql`: three lookup indexes only, no data reset or reimport. Apply pending D1 migrations to the intended database before deploying through the existing workflow. This implementation does not apply remote migrations, configure Access, deploy, or synchronize local edits to D1.
