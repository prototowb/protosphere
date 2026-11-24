# Session Handoff

> **Rolling document.** Replace contents each session — this is "what the next session needs to know," not a permanent log. For long-term project state, see `PROJECT_STATUS.md`.

**Updated**: 2026-11-24
**Last session focus**: PTSPH-211 (single sign-out across protocode.xyz) and PTSPH-212 (return to the sibling app after sign-in), **deployed 2026-11-24** (#39, #40 → #42).

---

## Start here

1. **Live since 2026-11-24:** PTSPH-211 and PTSPH-212.
   - PRs #39 and #40 (plus the tickets in #41) went into `development`, and #42 went to `main` (`47be7b5`). `dist-main` is `42142fd`, live bundle `index-CNSV80A4.js`, with lazy chunks `singleSignOut-*.js` and `loginRedirect-*.js`.
   - A live sign-in/sign-out test passed in both directions:
     - chat → learn sign-in;
     - a learn sign-out signs chat out;
     - "Sign in via Protosphere" returns to learn;
     - a chat sign-out signs learn out.
2. **What PTSPH-211 changed:**
   - **Marker:** `src/lib/singleSignOut.ts` reads and writes the shared marker `protocode-signout` (`{v:1, sids:[...]}`, at most 5 chat `session_id`s, `.protocode.xyz`, 30 days).
   - **Marking:** `makeHybridStorage` (`src/lib/supabase.ts`) adds the stored session's id whenever the session is removed. It never writes the shared access-token cookie for a listed session.
   - **Sign-out:** `useAuth` signs out locally when the stored session is listed, on start, on `visibilitychange` and on `pageshow`.
   - **Reset:** `resetAppToLogin` keeps the query string when it already is on `/login`, so a sibling app's `?redirect=` survives.
   - **Tests:** 393.
3. **What PTSPH-212 changed:** `src/lib/loginRedirect.ts` is the allowlist for `/login?redirect=`. It accepts in-app paths that start with a single `/`, or `https:` on protocode.xyz and its subdomains. The target is kept across OAuth (sessionStorage, 10 min) and followed for an already signed-in visitor (router guard). Tests: 435.
4. **Contract:** both are part of the cross-subdomain contract shared with Protocode Learn. If the marker's name, attributes or format change, change learn's reader too.
5. **Live smoke checks still to do (maintainer):**
   - as a non-admin member, a space with a required integration (the PTSPH-207 banner). First add a requirement to a space as its owner;
   - "Sign out" on one device keeps the other devices signed in (PTSPH-209).

## Not verified / behaviour changes to know about

- Profile/forum **custom CSS** drops `url()`, at-rules (`@media`, `@import`, …), `position: fixed|sticky` and CSS escapes. Pages relying on those render plainer.
- Page images/links accept only `http(s)` (images also same-origin `blob:` / raster `data:`); other schemes render without the URL.
- The only Tiptap component, `src/components/forum/PageEditor.vue`, is **not imported anywhere**. Mounted directly it works, but logs `[tiptap warn]: Duplicate extension names found: ['link']` (StarterKit v3 already bundles Link). Wire it up or delete it.
- `npm audit --audit-level=high` runs in `quality.yml` only, not in `build-dist.yml`: a new advisory fails the quality check without blocking deploys.
- The remote migration history records 050–055 under timestamp versions (the MCP's `apply_migration`), not `050`…`055`. `supabase db push` would try to re-apply them; run `supabase migration repair` first, or keep applying through the MCP.

## Open, and why

- **Server-side enforcement** of the remaining community rules — ROADMAP Phase 1 (details shared privately with the maintainer; needs a design pass for the forum-promotion path).
- **Unread / realtime redesign** — ROADMAP Phase 2. Includes mention badges: in `ServerPage.vue` the channel-open watcher calls `markRead` before the async `scanForMentions` finishes, so the scan never counts anything; simply reordering would make it notify for the channel being opened — redesign rather than patch.
- **Sign-out via session expiry** doesn't run the full reset yet. `lib/sessionReset.ts` covers user-initiated sign-out and, since PTSPH-211, a sign-out made in a sibling app. ROADMAP Phase 2.
- **`auth_bridge` removal** — inventory: `supabase/functions/auth-bridge/`, `[functions.auth-bridge]` in `config.toml`, `AuthBridgePage.vue` + route, `bridge` namespace in `backend/types.ts` / `supabase-backend.ts` / `local.ts`, `IntegrationAuthMode` / `AuthBridgeClaims` / `AuthBridgeResult` / `signing_key` in `types.ts`, signing-key UI in `AdminIntegrationsPage.vue`, `IntegrationCard.vue`, `IntegrationConnectDialog.vue`; forward migration to drop `signing_key`, the `auth_mode` CHECK value and the bridge index; undeploy the function.
- **Cross-subdomain sign-in, long term** — a redirect-based sign-in with chat as the identity provider (ROADMAP vision #1) would replace the shared cookie entirely. Supabase Auth's OAuth 2.1 server (beta) is the candidate; spike it on staging first.
- **CSP / security headers** — none set (hosting config). ROADMAP Phase 3.
- Tests under `src/test/**` are excluded from type-checking (`tsconfig.app.json`) — add a `tsconfig.vitest.json` as Protocode Learn has.

## Cross-subdomain SSO

`src/lib/supabase.ts` `makeHybridStorage` keeps the full session in localStorage and writes a script-readable cookie on `.protocode.xyz`; Protocode Learn exchanges it through its `protosphere-sso-exchange` function (JWKS-verified). Since PTSPH-210 (2026-11-23) it holds `encodeURIComponent(JSON.stringify({access_token, expires_at}))`, `max-age` = seconds until `expires_at`, `path=/; domain=.protocode.xyz; SameSite=Lax; Secure`. It's chunked as `<key>.0…` only above 3180 characters. Chat never restores its own session from the cookie. Learn's exchange trusts chat **prod** only by default (secret `PROTOSPHERE_TRUSTED_ISSUERS` to add staging). Rendering safety in either app matters to both.

Since PTSPH-211, both apps also share the sign-out marker `protocode-signout` (see above). Signing out of either app signs the browser out of both. Learn only exchanges the access-token cookie when it has no session of its own.

## Local tooling

- A local Supabase stack (`supabase_db_protocode-chat`, port 54322) is at migration **053**; `supabase/tests/055_access_control_hardening.sql` applies 054+055 inside a rolled-back transaction, so it leaves the DB unchanged.
- In Git Bash, prefix `docker exec … -f /tmp/x.sql` with `MSYS_NO_PATHCONV=1`.
- Sanitiser tests run under jsdom (`// @vitest-environment jsdom`): happy-dom mis-iterates after node removal and leaves elements DOMPurify removed in real browsers.
- `.mcp.json` MCP servers need `SUPABASE_CHAT_TOKEN`.
