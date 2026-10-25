# Share Your Mountain

A new Italian-first, responsive frontend for the original Share Your Mountain project. Uses the supplied white wordmark, original alpine photography and a real, explicitly historical catalog imported from the legacy repository.

## Run locally

Requires Node.js 22 or later. No dependencies or installation required.

```sh
npm start
```

Open the printed local URL (default `http://127.0.0.1:8787`). Set `PORT` to use another port. The server binds to loopback for local development.

```sh
npm test
npm run build
```

`dist/` is a static production site. Deploy its contents on any static web host. It needs no server-side runtime, API keys or credentials. This delivery is committed source code; no hosted production deployment is configured.

## Included

- Responsive discovery homepage, destination exploration and source/project information.
- Search across 1,337 actual legacy peaks and 381 actual legacy routes, with accent-insensitive multiword matching and suggestions.
- Mountain/route/activity filters, mountain ranges, minimum elevation, alphabetical/elevation ordering and pagination.
- Detail dialogs, original source links, related routes and OpenStreetMap links where coordinates exist.
- Personal saved adventures and completion tracking in this browser's local storage, with storage-error handling and a local-data deletion control.
- Shareable detail links and filter query strings.
- Keyboard-accessible native dialogs, labeled controls, reduced-motion support, lazy-loaded imagery and error/empty states.

## Historical data and production boundary

The catalog is the public **2015-07-31** snapshot at legacy commit `f71f235228f015e20fd0e1487ce597b3de5cab9c`. It is not a current production database or a verified guide to current mountain conditions. Missing coordinates, grades and measurements remain missing. The 2015 route snapshot includes Alpinismo, Vie Lunghe and Vie Ferrate; other activities in later code have no imported route records and are not advertised as available filters.

Accounts, social sign-in, public uploads, community publishing, synchronized lists, live weather and a live interactive map backend are not connected. Saved adventures work locally; maps open OpenStreetMap at the recorded location. Photo labels distinguish illustrative landscapes. External historical source URLs are preserved, including their original HTTP protocol; their current availability is unverified.

See [legacy audit](docs/LEGACY_AUDIT.md), [attributions](docs/ATTRIBUTIONS.md), and [verification](docs/VERIFICATION.md).

## Refresh the catalog reproducibly

Clone the legacy repository separately and check out the documented commit. Never copy its secrets, application settings, account tables or complete SQL dumps into this frontend.

```sh
node scripts/import-legacy.mjs /absolute/path/to/legacy
npm test
npm run build
```

The importer reads explicit public tables and writes an allowlisted `public/data/catalog.json`. SQL is parsed as text and never executed. Source associations are resolved against their original source domains. The current catalog remains historical until replaced with an authorized, verified current data export.
