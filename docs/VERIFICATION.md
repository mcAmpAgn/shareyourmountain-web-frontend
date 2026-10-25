# Verification

Verified locally on 2026-10-25 using Node.js 22 and the Codex in-app browser.

## Automated checks

`npm test`: 7 tests pass. Checks historical record counts, peak values, source URL reconstruction, unique IDs, accent-insensitive text search, combined activity/range/elevation filters, sorting, missing coordinates and metrics, public field allowlisting, output escaping and malformed/unavailable local storage.

`npm run build`: passes and emits a static `dist/` directory.

`node --check public/app.js`: passes.

## Browser checks

- Responsive homepage inspected at the available narrow preview width (approximately 521 pixels), including hero, branding, stacked search, cards, destination images and footer.
- Opened Cervino detail, checked archived elevation, country and coordinate map link.
- Saved Cervino, marked it completed, reloaded the page and verified the saved completion persisted.
- Removed the test save and confirmed the list was empty again.
- Searched Resegone and checked the 6 matching results.
- Opened Resegone detail and its six related route entries.
- Opened Bastionata - via Bonatti and verified its historical source link and available measurements.
- Selected the via ferrata filter and combined it with minimum altitude; the historical result remained consistent.

No live legacy backend, production deployment, external route-site availability, user accounts or cross-device synchronization was tested. Desktop CSS is implemented but no wide desktop screenshot was obtained in the available in-app pane. The GitHub workflow runs tests/builds after push; its remote result must be checked separately.
