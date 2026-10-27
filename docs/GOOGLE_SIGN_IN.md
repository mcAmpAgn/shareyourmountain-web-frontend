# Google sign-in for favourites

Production sign-in uses Google through Cloudflare Access. The Worker continues to validate Access JWT signatures, issuer, audience and expiry, and every D1 adventure query stays scoped to the verified profile. No Google tokens or client secret are stored in React or D1. This implements the application flow; Google/Cloudflare account configuration is still required.

## Configure the identity provider

1. Create a Google Cloud project and configure its OAuth consent screen for your audience. Create a **Web application** OAuth client.
2. Use `https://YOUR-TEAM.cloudflareaccess.com` as the authorized JavaScript origin and `https://YOUR-TEAM.cloudflareaccess.com/cdn-cgi/access/callback` as the authorized redirect URI. Substitute the real Access team domain.
3. In Cloudflare Zero Trust, go to **Integrations → Identity providers**, add **Google**, and enter the OAuth client ID and client secret there. Keep the secret out of Git, browser code, Worker vars and chat.
4. Test the Google provider in Cloudflare.
5. For the site's self-hosted Access application covering `/api/me/*`, select Google as its only login method and disable accepting every available identity provider. Enable instant authentication if available to skip provider selection. Configure an explicit Allow policy for your intended users; Google sign-in alone does not grant authorization.

See the [official Google integration instructions](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/google/) for current dashboard steps.

## Connect this application

Complete the D1, custom-domain and Access setup in [CLOUDFLARE.md](CLOUDFLARE.md). Set Worker variables:

```text
ACCESS_TEAM_DOMAIN=https://YOUR-TEAM.cloudflareaccess.com
ACCESS_AUD=YOUR-ACCESS-APPLICATION-AUD-TAG
ACCESS_LOGIN_PROVIDER=google
```

The last setting selects the Google button label; the Google-only authentication restriction belongs to the Access application configuration. Its default in `wrangler.jsonc` does not configure an identity provider by itself. If another provider is used, remove that setting so the UI shows a generic sign-in label. Without team domain and AUD, online saves remain disabled.

## Visitor flow

The catalog and map stay public. Selecting a heart while signed out opens a sign-in dialog. Continue with Google navigates to the Access-protected `/api/me/login` route. After authentication, the Worker redirects only to a validated mountain/route detail or the adventures panel; it accepts no arbitrary return URL.

For a selected adventure, the browser records a ten-minute same-tab intent containing only entity type and ID. After login, a matching intent is consumed once and saved using the normal authenticated POST. A copied login-return URL cannot save anything without that intent. If browser storage is blocked, login still returns to the detail and the visitor selects save again. A failed save offers retry. No existing account's local favourites are migrated or uploaded.

Expired API sessions clear displayed personal data and prompt another sign-in. The API client identifies AJAX requests so Access can return 401 instead of a login page. The adventures panel links to Access logout, which also ends the user's Access session for other connected applications; it does not sign out their Google account. See [Access session management](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/).

## Verification

After deployment, use two different permitted Google accounts. Confirm each account sees only its own favourites, an unapproved account is denied, anonymous saves require sign-in, the selected favourite survives the login round trip, and logout/expiry requires login again. Test the actual custom domain; local synthetic JWT tests cannot validate your Google consent screen or Cloudflare policies.

The Node server on port 8787 remains a loopback-only development profile and is labelled as such in the adventures panel. Real Google login is tested through the configured Cloudflare application, not through that local profile. No fake Google account or authentication bypass is included.
