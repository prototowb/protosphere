# Session Handoff

> **Rolling document.** Replace contents each session — this is "what the next session needs to know," not a permanent log. For long-term project state, see `PROJECT_STATUS.md`.

**Updated**: 2026-11-17
**Last session focus**: Re-assessment after a ~3-month pause — hardening pass (PTSPH-206) and an enhancements roadmap (`docs/ROADMAP.md`). Companion pass on Protocode Learn (PROJ-197).

---

## Start here

1. **Production is very likely running a client that predates migration 054.** 054 was applied to the production DB on 2026-08-04, but its client half (`9e21a32`) only reached `development`; `dist-main` is still built from June's `main`. With 054 live, the old client's `integrations(*)` embed returns null for non-owners — integration sync, profile integration data and the Settings connect list should be broken for regular members. **30-second check:** on chat.protocode.xyz, as a non-owner, open Settings → Integrations, or view a profile with a connected integration. **Fix:** promote `development` → `main` (the two commits are independent of this branch).
2. **Branch `bugfix/PTSPH-206-hardening-pass` (off `development`) holds all changes, UNCOMMITTED.** Nothing pushed, merged or deployed.
3. **Deploy order for PTSPH-206 matters** (see below): migration 055 → staging smoke test → production → deploy the client → *then* push the branch. This repository is public; push only after production is patched.
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

0. As of 2026-11-19 both Supabase projects (`chat`, `chat-staging`) show as **paused (INACTIVE)**. Restore staging first. When you restore production, apply 055 (step 3) straight away, before announcing it's back.
1. Run the migration test locally (rolls back; see the file header):
   `supabase/tests/055_access_control_hardening.sql` — every line must start with `PASS`.
2. `supabase db push` (staging is the linked default). Smoke-test on staging: approve a pending user from the approvals page, start a DM, react to a message, view a profile with a connected integration, sign out/in.
3. Production: `supabase db push --project-ref porlhhdajfaamvggcrbi`.
4. Merge to `development` → `main` so the client ships (`getPublicUserData` needs the new RPC).
5. After deploy, check for legacy reaction rows that would violate the new constraint, then validate it:
   ```sql
   select count(*) from reactions where not (char_length(emoji) between 1 and 64 and emoji !~ '[<>"''&\\[:cntrl:]]');
   alter table reactions validate constraint reactions_emoji_token;
   ```
6. Recommended: review `profiles` for unexpected `account_status`/`username` changes and `community_settings.owner_id` against expectations.

## Not verified / behaviour changes to know about

- **Browser check (2026-11-19, Playwright, local backend):** these all passed:
  - Register, setup wizard, chat message with a link (`https`, `rel="noopener noreferrer"`), reaction.
  - Forum page: create, edit with BlockEditor, save, reload. A safe link got `nofollow`; `javascript:`, `<script>` and `onerror` were stripped.
- The only Tiptap component, `src/components/forum/PageEditor.vue`, is **not imported anywhere**, so the `prosemirror-view` bump doesn't reach users. Mounted directly, it works: marks, headings, lists, code block, HTML paste (sanitised), and a save/reload round trip.
  - It logs `[tiptap warn]: Duplicate extension names found: ['link']`, because StarterKit v3 already bundles Link.
  - Either wire it up or delete it.
- Migration 055 was tested on the **local** schema only. After applying on staging and production, list the policies on `profiles`, `community_settings`, `direct_message_members`, `direct_messages`, `user_integrations` and confirm the old broad policies are gone (`DROP POLICY IF EXISTS` silently no-ops on a name mismatch).
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
