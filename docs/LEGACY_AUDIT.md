This is the original source audit recorded before the React/SQLite implementation. See [ARCHITECTURE.md](ARCHITECTURE.md) and the root README for the current implementation.

# Legacy project audit and migration map

Source: https://gitlab.com/campagna.marcello/shareyourmountain

Inspected master snapshot: `f71f235228f015e20fd0e1487ce597b3de5cab9c`. Audit date: 2026-10-25.

## Product intent

The original landing page and Project view describe an aggregator of public mountain and route information, combining external route reports, geographic open data and personal adventures. The original Italian copy centers on finding the next adventure, sharing experiences and making scattered information discoverable. The provided 2014 screenshots show the earlier peak/range/country search. Later source expands this into activity-driven route discovery.

This frontend retains that intent with an Italian discovery homepage, original branding and photography, a searchable historical archive, source attribution and a personal adventure list.

## Architecture observed

| Area | Evidence and behavior | Migration disposition |
| --- | --- | --- |
| Web application | `SYM.WebApp`, ASP.NET MVC/Razor, controllers and views, Bootstrap/jQuery themes | Replaced by dependency-free browser modules and responsive CSS |
| Business layer | `SYM.BusinessLayer/Services`, route summaries, mountain data, ranking and wishlist services | Frontend filters and local adventure states; server behavior documented for future integration |
| Data access | `SYM.DataAccessLayer/Model.edmx`, Entity Framework model and generated entities; MySQL | Explicit public-field JSON export; no direct browser-to-database access |
| Identity | `MySql.AspNet.Identity`, Account/Manage/Auth controllers, user profiles and social connections | No legacy users, credentials, cookies or authentication mechanisms migrated |
| Localization | `SYM.Localization/Resources`, Italian and default resources; `HomeController.ChangeLang` culture cookie | Italian-first delivery; content and state separated into browser modules |
| Search | `RouteController.Index/Index3`, `RouteService.GetRoutesSummary`, `AutocompleteController` | Local text search, suggestions, range/activity/altitude filters, sort and pagination |
| Mountain taxonomy | `mountain`, mountain ranges/groups, countries/regions, valleys | Range names, country associations, elevations and available coordinates preserved |
| Route details | Route Razor details: activity, grades, elevation, length, approach, images, external reports, map and nearby routes | Available public snapshot fields, links and mountain-to-route associations preserved; absent values explicitly missing |
| Adventure list | `AdventureController.Set/Remove/Get`, `AdventureService`, `user_wishlist`, done flag | Device-local saves and completion state; no claim of account sync |
| Community and media | Community/Profile/Gallery/Feed controllers; upload and gallery partials, Cloudinary URLs, external social components | Project story and existing asset reuse; live media uploads/feeds require new backend |
| Geography | Autocomplete nearest-mountain procedure, map filters above 1500/2500/3500m, geolocation on legacy home | Elevation filters and OpenStreetMap links; no automatic geolocation requests |
| ETL | DBPedia crawler, OpenStreetMap importer, FerrateIt, image discovery, common/data-access libraries | Not run or ported. Historical source metadata only; modern ingestion needs independent design |
| Weather | `SYM.Meteo` separate static site describes Yahoo weather service | No live weather or forecast claims |
| Other surfaces | ScuolaMontanari, source/partner/statistics views, shop book view, sitemap and privacy | Recorded as legacy scope; no invented inventory, statistics or transactions |

## API shape and future integration

`SYM.WebApp/App_Start/WebApiConfig.cs` uses `api/{controller}/{action}`. Examples in inspected source:

- `POST api/autocomplete/GetMountains`, fields `p_term`, `p_countryId`, `p_regionId`.
- `POST api/autocomplete/GetMountain`, field `p_mountainId`; projects id, name, altitude, latitude/longitude and range.
- `POST api/autocomplete/GetMountainByRange`, `p_rangeId`; projects map records and route counts.
- `POST api/autocomplete/GetNearestMountainByLocation`, latitude/longitude, minimum elevation or route-only filter and user context.
- `POST api/autocomplete/GetTopos`, text and geography filters.
- Adventure actions `Set`, `Remove`, `Get` include mountain/route/hut identifiers, done status and profile context.

These are observed source contracts, not verified running endpoints. The new frontend does not call them. Before production integration, introduce a versioned API adapter, server-side authentication and ownership checks, input validation, pagination, current geographic data and an explicit error contract. Never trust a client-supplied profile ID as authorization. Do not revive old API keys or third-party scripts.

## Data import

The later `Sql/symcore_*.sql` files inspected are schemas, without insert data for mountains/routes. The older `SYM.WebApp/dumps/Dump20150731/` contains the usable public snapshot. The importer derives columns from each table schema rather than assuming newer Entity Framework field order.

Read tables: mountain, route, mntn_mountainrange, geo_region, act_activity, route_webinfo, ass_mountaincountry, source. Output fields are allowlisted and reconciled in automated tests. Public source paths are combined with their source domain. Zero or invalid coordinates become null. Elevation anomalies in the original catalog are retained rather than silently corrected; this data requires review before use for planning.

Not imported: users, login providers, password material, profile/contact details, private wishlists, application configs, logs, email integrations, database connection strings or full SQL files. Legacy application code was inspected, not executed.

## Implementation choices

A static frontend is enough for the delivered discovery and device-local features and does not assume an available legacy server. The public catalog is fetched once, then filtered locally. HTML escaping is applied at every catalog rendering boundary. Dialogs use browser-native focus handling. No analytics, external fonts or third-party runtime JavaScript are loaded. The original Apache license in the destination repository is retained.

## Work remaining for a full platform migration

Current catalog validation and ongoing ingestion, authenticated profiles, synchronized adventure lists, user contributions and moderation, upload storage, geographic map/route tracks, live conditions/weather, full bilingual content and server-backed search are separate implementation work. This release does not imply these legacy features have been migrated or that their old services are still available.
