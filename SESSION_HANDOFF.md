# Session Handoff

> **Rolling document.** Replace contents each session — this is "what the next session needs to know," not a permanent log. For long-term project state, see `PROJECT_STATUS.md`.

**Updated**: 2026-11-17
**Last session focus**: Re-assessment after a ~3-month pause — hardening pass (PTSPH-206) and an enhancements roadmap (`docs/ROADMAP.md`). Companion pass on Protocode Learn (PROJ-197).

---

## Start here

1. **Production is very likely running a client that predates migration 054.** 054 was applied to the production DB on 2026-08-04, but its client half (`9e21a32`) only reached `development`; `dist-main` is still built from June's `main`. With 054 live, the old client's `integrations(*)` embed returns null for non-owners — integration sync, profile integration data and the Settings connect list should be broken for regular members. **30-second check:** on chat.protocode.xyz, as a non-owner, open Settings → Integrations, or view a profile with a connected integration. **Fix:** promote `development` → `main` (the two commits are independent of this branch).
2. **Migration 055 is LIVE in production (applied 2026-11-20 via the Supabase MCP).** The client half of branch `bugfix/PTSPH-206-hardening-pass` is committed locally but **not pushed or deployed**. Until it ships, the old production client:
   - shows no integration data on other members' profiles (the new RPC isn't used yet)
   - still has the client-side rendering fixes outstanding
   Ship it by pushing, then promoting `development` → `main`. Keep the gap between push and deploy short.
3. **chat-staging is still paused, and 055 is not applied there.** When you restore it, run `supabase db push` against staging.
4. `docs/ROADMAP.md` is the new enhancements plan.

## What PTSPH-206 changed

| Area | Change | Verified by |
|---|---|---|
| CI | `type-check` was `vue-tsc --noEmit` against a references-only root tsconfig → checked **0 files**. Now `vue-tsc -b`; Node 20 (EOL) → 22; runtime `npm audit --audit-level=high` gate | `tsc --listFiles` count |
| Deps | Runtime audit 10 high → 0, resolved with `--before=2026-11-03` (≥2-week-old packages only). Added `dompurify@3.4.17` (exact) and `jsdom` (dev) | `npm audit --omit=dev` |
| Rendering | `escapeHtml` now escapes quotes (it is used inside attributes by the markdown auto-linker); `EmojiIcon` renders unknown input as text; page blocks (forum/profile) sanitised by an allowlist (`lib/pageSanitize.ts`: DOMPurify, http(s)/image URL checks, scoped custom CSS) | unit tests (red→green, negative control on `EmojiIcon`); **real Chromium**: 14/14 checks, no injected script executed |
| Migration 055 | Access-control hardening: profile updates (own row; registration moderators may change `account_status` only), community ownership / setup flag guarded, DM membership requires membership, DM edits can't move conversations, `user_integrations` owner-only + `get_public_user_integrations()` (field visibility enforced server-side — "Only me" fields were visible to profile viewers), reaction value constraint, `search_path` on 054's function | `supabase/tests/055_access_control_hardening.sql` on the local stack: 21/21 with 055 (re-run 2026-11-19); every negative check fails without it |
| Integrations | `lib/integrations.ts`: https-only targets (http only for loopback), 10 s fetch timeout, payload validation + size cap; profile views no longer sync *other* users' rows (that sent the viewer's token to the integration and then failed to write) | unit tests |
| Session | User-initiated sign-out (`logout` / `logoutGlobal`) always ends with a full reload (`lib/sessionReset.ts`), so Pinia stores, the presence channel and module caches can't leak into the next account. Sign-out arriving via session expiry or another tab is not covered yet (Phase 2) | unit tests |

Full gate: `vue-tsc -b` clean, lint clean (6 pre-existing `vue/no-v-html` warnings, all now reviewed), **319 tests**.

## Deploying PTSPH-206

**Production done (2026-11-20):**
- Read-only prechecks: 054 applied, the policy names 055 drops all exist, 0 reactions violate the new constraint.
- **Schema drift found:** 024's `auto_join_dm_creator` and its `on_dm_group_created` trigger were missing in production, although 024 is recorded as applied. The committed 055 would have broken DM creation; the negative control fails `DM add members`. 055 now recreates both, and the regression test reproduces the drift. 21/21.
- A full schema comparison (triggers, functions, policies) against the migrations found no other drift.
- Dry run inside a rolled-back transaction, then applied, then `VALIDATE CONSTRAINT reactions_emoji_token`. Policies and triggers re-listed to confirm.
- The remote migration history records 055 under a timestamp version, the same pattern as 050–054. `supabase migration repair` may be needed before the next `db push`.

**Still to do:**
1. Staging, once restored: `supabase db push`, then smoke-test: approve a pending user, start a DM, react, view a profile with an integration, sign out and in.
2. Ship the client: push the branch, then merge `development` → `main` so `dist-main` rebuilds.
3. Recommended: review `profiles` for unexpected `account_status`/`username` changes, and check `community_settings.owner_id` is what you expect.
4. Remaining security-linter items are tracked in ROADMAP Phase 1 (details shared privately).

## Not verified / behaviour changes to know about

- **Browser check (2026-11-19, Playwright, local backend):** these all passed:
  - Register, setup wizard, chat message with a link (`https`, `rel="noopener noreferrer"`), reaction.
  - Forum page: create, edit with BlockEditor, save, reload. A safe link got `nofollow`; `javascript:`, `<script>` and `onerror` were stripped.
- The only Tiptap component, `src/components/forum/PageEditor.vue`, is **not imported anywhere**, so the `prosemirror-view` bump doesn't reach users. Mounted directly, it works: marks, headings, lists, code block, HTML paste (sanitised), and a save/reload round trip.
  - It logs `[tiptap warn]: Duplicate extension names found: ['link']`, because StarterKit v3 already bundles Link.
  - Either wire it up or delete it.
- Migration 055 is confirmed in **production** (2026-11-20, read-only checks): its functions, triggers and the `reactions_emoji_token` constraint are present, and the old broad policies are gone (`user_integrations` has only the owner policy). Staging still needs it once restored; repeat the policy check there, because `DROP POLICY IF EXISTS` silently no-ops on a name mismatch.
- Profile/forum **custom CSS** now drops `url()`, at-rules (`@media`, `@import`, …), `position: fixed|sticky` and CSS escapes. Pages relying on those will render plainer.
- Page images/links accept only `http(s)` (images also same-origin `blob:` / raster `data:`); other schemes now render without the URL.
- The new `npm audit --audit-level=high` step runs in `quality.yml` only, not in `build-dist.yml`, so a new advisory fails the quality check without blocking deploys.
- `build-dist.yml` and `quality.yml` now use Node 22.

## Open, and why

- **Server-side enforcement** of the remaining community rules — ROADMAP Phase 1 (details shared privately with the maintainer; needs a design pass for the forum-promotion path).
- **Unread / realtime redesign** — ROADMAP Phase 2. Includes mention badges: in `ServerPage.vue` the channel-open watcher calls `markRead` before the async `scanForMentions` finishes, so the scan never counts anything; simply reordering would make it notify for the channel being opened — redesign rather than patch.
- **`auth_bridge` removal** — inventory: `supabase/functions/auth-bridge/`, `[functions.auth-bridge]` in `config.toml`, `AuthBridgePage.vue` + route, `bridge` namespace in `backend/types.ts` / `supabase-backend.ts` / `local.ts`, `IntegrationAuthMode` / `AuthBridgeClaims` / `AuthBridgeResult` / `signing_key` in `types.ts`, signing-key UI in `AdminIntegrationsPage.vue`, `IntegrationCard.vue`, `IntegrationConnectDialog.vue`; forward migration to drop `signing_key`, the `auth_mode` CHECK value and the bridge index; undeploy the function.
- **CSP / security headers** — none set (hosting config). ROADMAP Phase 3.
- Tests under `src/test/**` are excluded from type-checking (`tsconfig.app.json`) — add a `tsconfig.vitest.json` as Protocode Learn now has.

## Cross-subdomain SSO (unchanged, still true)

`src/lib/supabase.ts` `makeHybridStorage` writes the session to localStorage and a compact, JS-readable cookie on `.protocode.xyz`; Protocode Learn exchanges it via its `protosphere-sso-exchange` function (JWKS-verified). Because the cookie is script-readable, rendering safety in **either** app protects both — see ROADMAP vision #1 for the long-term fix. Learn's exchange now trusts chat **prod** only by default (secret `PROTOSPHERE_TRUSTED_ISSUERS` to add staging).

## Local tooling

- A local Supabase stack (`supabase_db_protocode-chat`, port 54322) is at migration **053**; the 055 test applies 054+055 inside a rolled-back transaction, so it leaves the DB unchanged.
- In Git Bash, prefix `docker exec … -f /tmp/x.sql` with `MSYS_NO_PATHCONV=1`.
- Sanitiser tests run under jsdom (`// @vitest-environment jsdom`): happy-dom mis-iterates after node removal and leaves elements DOMPurify removed in real browsers.
- `.mcp.json` MCP servers need `SUPABASE_CHAT_TOKEN`; not used this session (no remote DB access was made).
