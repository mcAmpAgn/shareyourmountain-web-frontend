# Route editing API

The edit API covers existing **active routes**, including `/routes/172` (Pizzo Badile - via Molteni). It does not add a browser edit form, create/delete records, change publication status, edit mountains or change sources/images. Public read endpoints remain unchanged.

## Endpoints

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/editor/routes/:id` | Current editable fields, with an `ETag` response header |
| PATCH | `/api/editor/routes/:id` | Update supplied fields only; requires `If-Match` containing the exact ETag from GET |

Both responses are JSON with `Cache-Control: no-store`. The PATCH response includes fresh fields and a new ETag. IDs are positive 32-bit integers. PATCH requires JSON and a same-origin `Origin` header; the request limit is 16 KB. Send only changed fields, not the complete GET response (id and updatedAt are read-only).

Editable fields: `name`, `title`, `area`, `activityId`, `difficultyRaw`, `elevationM`, `lengthM`, `heightM`, `lengthDescription`, `latitude`, `longitude`. Measurements are integers in metres. Difficulty stays a literal historical grade, not an invented normalized scale. Nullable fields can be cleared explicitly with null. Name cannot be cleared; the resulting record must retain a display name. Coordinates must both be present or both null. Unknown fields, empty patches and invalid activity references are rejected.

## Local use

The Node API allows the editor only from loopback on a localhost hostname, matching the existing local-profile boundary. Mutations additionally require a same-origin Origin header. No production identity is simulated locally.

After starting the local app, run this in its browser console (the example changes the difficulty):

```javascript
const path = '/api/editor/routes/172';
const current = await fetch(path);
if (!current.ok) throw new Error(await current.text());
const record = await current.json();
const saved = await fetch(path, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'If-Match': current.headers.get('ETag'),
  },
  body: JSON.stringify({ difficultyRaw: 'V+' }),
});
if (!saved.ok) throw new Error(await saved.text());
console.log(await saved.json());
```

Browser fetch supplies the Origin header for this same-origin mutation. React callers should retain the ETag with the loaded record, submit a minimal patch, and ask the editor to reload on 412. Do not automatically overwrite a conflicting record.

## Cloudflare setup

1. Apply `0005_route_edit_search.sql` to the intended D1 database before deploying the editor. Use the repository's `npm run d1:migrate:remote` after reviewing pending migrations. Do not reimport or reset the production catalog. Local Node migrations apply on startup; local D1 uses `npm run d1:migrate:local`.
2. Configure a **separate Cloudflare Access application** for `/api/editor/*`, with an Allow policy restricted to trusted catalog editors. Google can be the identity provider. Keep the ordinary catalog and `/api/routes/*` public. Use a custom domain if the account's Workers Access setup cannot secure individual workers.dev paths.
3. Set `ACCESS_TEAM_DOMAIN` and `ACCESS_EDITOR_AUD` on the Worker. The editor AUD must belong to that editor application and differ from `ACCESS_AUD` used for personal favourites. It is an identifier, not a secret. Do not grant every Google account editing access.
4. Sign in through the editor application, then call the editor endpoint on that same site. The Worker verifies the Access JWT signature, issuer, audience and expiry. A normal favourites token, forged headers and missing editor configuration cannot grant write access. No provider token or personal account data is stored by this API.

Until Access is configured, the online editor fails closed with 503. Requests lacking a valid editor JWT return 401. This change does not configure Access, apply remote migrations or deploy automatically.

See [Cloudflare application tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/) and [Access application domain/path configuration](https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/applications/).

## Consistency and migrations

A conditional UPDATE compares the complete editable snapshot, protecting against simultaneous writers. Search-name updates run in an SQLite/D1 trigger within the same statement; a failed search update rolls back the record change. A new indexed entity-key/FTS-rowid mapping avoids a full search-table scan for every edit. The migration backfills the mapping once; new sanitized imports rebuild it after populating FTS. The same migration exists for local SQLite and D1.

The private editor read always bypasses caches. Public detail/list/autocomplete responses retain existing bounded caching and can show old values until their TTL expires (up to five minutes for details/lists). Refetching the private editor endpoint confirms the actual stored record immediately. No write response is cached.

Error statuses: 400 invalid input; 401 missing/invalid editor JWT; 403 invalid origin or nonlocal development access; 404 inactive/missing route; 412 stale or concurrently changed record; 413 oversized body; 415 non-JSON body; 428 missing If-Match; 503 missing online editor configuration. Unsupported methods on the Worker return 405.
