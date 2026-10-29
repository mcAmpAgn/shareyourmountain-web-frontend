# Mountain photo galleries

Mountain details now use a larger responsive dialog, a photographic header, source tabs, thumbnail navigation and per-image credits. Historical archive images remain available. The photo endpoint is `GET /api/mountains/:id/photos?provider=commons|instagram`; it only accepts active catalog mountains and a known provider.

## Open photographs: Wikimedia Commons

No account or API key is required. The backend resolves the mountain's historical Wikipedia article (or its exact Italian catalog title) to Wikidata, then loads its representative image (P18) first, followed by its Commons category (P373 / commonswiki sitelink). Duplicate files are removed. Either source can still work if the other fails. It does not substitute photos found near arbitrary coordinates or claim that a fuzzy name match is the same mountain.

Imageinfo provides photographer credit, licence and the original file page. The UI displays them as plain text and links, never provider HTML. Only HTTPS Wikimedia image URLs, raster photo formats and records with licence metadata are returned. A category may contain mixed media; unsupported files are skipped. Some mountains have no connected category or photos, and the UI reports this instead of inventing a gallery.

Commons results are cached in bounded server memory for one hour; Instagram results for five minutes. Requests for the same mountain/provider are coalesced. Unavailable providers are not cached. Each gallery request performs one indexed catalog-reference query, never a full detail hydration or a per-photo D1 query. No photos, posts, personal data or tokens are imported into D1. This endpoint is excluded from the public edge-response cache so changing credentials/configuration cannot expose stale integration state.

## Public Instagram hashtag gallery

The implemented adapter uses **Instagram API with Facebook Login**, not Instagram Basic Display or Instagram Login. It reads `/{hashtag-id}/top_media` for an explicitly configured mountain hashtag and returns up to nine image/carousel pictures with links to the original posts. It does not scrape Instagram or claim to return all public photos. Public hashtag results are a curated preview; irrelevant hashtagged posts are possible, and private/deleted/restricted media may not be returned.

### Meta setup

1. Create/configure a Meta developer app supporting Instagram API with Facebook Login. Connect an eligible Instagram professional account to a Facebook Page.
2. Follow Meta's current Hashtag Search requirements, including the applicable `instagram_basic` and `pages_read_engagement` permissions and **Instagram Public Content Access** review/approval for public hashtag data. Account/Page discovery may also require `pages_show_list`. Complete the production access, app review and business verification steps Meta requests. The integration does not need publishing or messaging permissions.
3. Obtain a server-side access token for the approved account. Test it in Meta's tools. Keep it out of chat, Git, frontend `VITE_*` variables and public logs. Choose a currently supported Graph API version from your Meta app dashboard; the application intentionally does not guess a version.
4. Use Meta's authenticated `GET /{version}/ig_hashtag_search?user_id={instagram-user-id}&q={hashtag-without-hash}` to resolve the intended hashtag. Record the returned ID. Verify the hashtag refers to the intended mountain, including aliases such as Cervino/Matterhorn.
5. Maintain a small approved mapping of local mountain IDs to hashtag IDs. Meta limits hashtag discovery; check its current rolling-window limits before expanding the mapping. The app never automatically searches hashtags for the complete mountain catalog.

### Cloudflare configuration

Store the access token using the Worker dashboard's **secret** field or:

```powershell
npx wrangler secret put INSTAGRAM_ACCESS_TOKEN
```

Add these server-side Worker variables in Settings → Variables & Secrets:

| Setting | Value |
| --- | --- |
| `INSTAGRAM_USER_ID` | Approved professional Instagram user ID |
| `INSTAGRAM_API_VERSION` | Supported version, in the form `vNN.N` |
| `INSTAGRAM_MOUNTAIN_HASHTAGS` | JSON object mapping mountain IDs to string hashtag IDs, e.g. `{"10":"YOUR_NUMERIC_HASHTAG_ID"}` |

Replace the placeholder with the real numeric ID. Keep access-token rotation and expiry under account-owner control. After updating configuration, verify `/api/mountains/10/photos?provider=instagram` returns `ready`, then open the Instagram tab in the mountain dialog. The token is only sent as an Authorization header to graph.facebook.com and is never returned to the browser. Missing configuration returns `not_configured`; token/permission/network errors return `unavailable` with no raw provider errors or secrets.

For Node development, set the same four variables in the server process environment and restart `npm run dev`. `.env` files are examples, not automatically loaded. Local Worker development can use ignored `.dev.vars`. Never commit either real credentials or private account exports. The app remains usable with Commons while Instagram is unconfigured.

### Verification and limits

Automated tests use fake provider responses to check matching, credits, URL validation, caching, failures and credential isolation. Instagram cannot be live-verified until the owner supplies approved Meta configuration. Signed CDN image links can expire or posts can be deleted; failed images show a placeholder and the source-post link remains available. Instagram content retains the author's rights and is not presented as openly licensed Wikimedia content.

References:

- [Wikimedia Imageinfo API](https://www.mediawiki.org/wiki/API:Imageinfo)
- [Wikimedia category members](https://www.mediawiki.org/wiki/API:Categorymembers)
- [Meta's official Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api)
- [Meta Hashtag Search](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/hashtag-search/)
