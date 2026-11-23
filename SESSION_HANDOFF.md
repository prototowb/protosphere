# Session Handoff

> **Rolling document.** Replace contents each session — this is "what the next session needs to know," not a permanent log. For long-term project state, see `PROJECT_STATUS.md`.

**Updated**: 2026-11-23
**Last session focus**: Post-release bookkeeping after the November hardening pass (PTSPH-206…209 all live), chat-staging restored and brought to migration 055, and PTSPH-210 (minimal shared SSO cookie) started.

---

## Start here

1. **Everything from the hardening pass is live (2026-11-21).**
   - PTSPH-206 via #28 → `development`, #29 → `main`.
   - PTSPH-207 (#31), 208 (#32) and 209 (#33) via #34 → `main`.
   - `dist-main` was rebuilt from `36155a6` (`41e2f5c`), and chat.protocode.xyz serves it. `development` = `main`.
2. **Migration 055 is applied in production (2026-11-20) and on staging (2026-11-23).**
   - Staging was restored from pause on 2026-11-23.
   - Before applying, its schema (policies, triggers, functions, constraints, columns) was compared with production. The only differences were 055's own changes, plus line endings in six function bodies.
   - 055 was dry-run in an aborted transaction, then applied with `055b` (`VALIDATE CONSTRAINT reactions_emoji_token`). Afterwards staging matches production.
   - Still to do on staging-chat.protocode.xyz: approve a pending user, start a DM, react, view a profile with an integration, sign out and in.
3. **PTSPH-210 is in progress, local only:** branch `feature/PTSPH-210-minimal-sso-cookie` (`5514087`). The shared cookie holds only `{access_token, expires_at}` and expires with the token; chat reads its own session from localStorage only; every page load re-syncs the cookie, which replaces cookies written by earlier builds. Gate on the branch: `vue-tsc -b` clean, lint 0 errors (6 known warnings), 354/354 tests (20 new in `src/test/lib/supabase-session-cookie.test.ts`), build OK. It ships **after** Protocode Learn's reader for the new format (PROJ-205) is live. Keep the gap between push and deploy short.
4. **Live smoke checks still to do (maintainer):**
   - one real SSO sign-in, chat → learn;
   - as a non-admin member: Settings → Integrations, a profile with learn data, and a space with a required integration (the PTSPH-207 banner);
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
- **Sign-out via session expiry or another tab** doesn't run the full reset yet (`lib/sessionReset.ts` covers user-initiated sign-out only). ROADMAP Phase 2.
- **`auth_bridge` removal** — inventory: `supabase/functions/auth-bridge/`, `[functions.auth-bridge]` in `config.toml`, `AuthBridgePage.vue` + route, `bridge` namespace in `backend/types.ts` / `supabase-backend.ts` / `local.ts`, `IntegrationAuthMode` / `AuthBridgeClaims` / `AuthBridgeResult` / `signing_key` in `types.ts`, signing-key UI in `AdminIntegrationsPage.vue`, `IntegrationCard.vue`, `IntegrationConnectDialog.vue`; forward migration to drop `signing_key`, the `auth_mode` CHECK value and the bridge index; undeploy the function.
- **Cross-subdomain sign-in, long term** — a redirect-based sign-in with chat as the identity provider (ROADMAP vision #1) would replace the shared cookie entirely. Supabase Auth's OAuth 2.1 server (beta) is the candidate; spike it on staging first.
- **CSP / security headers** — none set (hosting config). ROADMAP Phase 3.
- Tests under `src/test/**` are excluded from type-checking (`tsconfig.app.json`) — add a `tsconfig.vitest.json` as Protocode Learn has.

## Cross-subdomain SSO

`src/lib/supabase.ts` `makeHybridStorage` keeps the full session in localStorage and writes a script-readable cookie on `.protocode.xyz`; Protocode Learn exchanges it through its `protosphere-sso-exchange` function (JWKS-verified). Until PTSPH-210 ships, the cookie holds a compact copy of the session. With PTSPH-210 it holds `encodeURIComponent(JSON.stringify({access_token, expires_at}))`, `max-age` = seconds until `expires_at`, `path=/; domain=.protocode.xyz; SameSite=Lax; Secure`. It's chunked as `<key>.0…` only above 3180 characters. Chat never restores its own session from the cookie. Learn's exchange trusts chat **prod** only by default (secret `PROTOSPHERE_TRUSTED_ISSUERS` to add staging). Rendering safety in either app matters to both.

## Local tooling

- A local Supabase stack (`supabase_db_protocode-chat`, port 54322) is at migration **053**; `supabase/tests/055_access_control_hardening.sql` applies 054+055 inside a rolled-back transaction, so it leaves the DB unchanged.
- In Git Bash, prefix `docker exec … -f /tmp/x.sql` with `MSYS_NO_PATHCONV=1`.
- Sanitiser tests run under jsdom (`// @vitest-environment jsdom`): happy-dom mis-iterates after node removal and leaves elements DOMPurify removed in real browsers.
- `.mcp.json` MCP servers need `SUPABASE_CHAT_TOKEN`.
