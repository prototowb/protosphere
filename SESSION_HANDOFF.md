# Session Handoff

> **Rolling document.** Replace contents each session — this is "what the next session needs to know," not a permanent log. For long-term project state, see `PROJECT_STATUS.md`.

**Updated**: 2026-08-04
**Last session focus**: Cross-platform auth review — found and fixed a live data-leak vulnerability, corrected prior session's architectural plan. Fully closed out: fixed, deployed, verified, committed, PR'd, and merged on both repos.

---

## What happened this session

Reviewed the cross-platform auth plan from the 2026-06-04/05 sessions (flip `protocode-learn` to
`auth_mode = 'auth_bridge'`, add Bearer token to sync). That plan turned out to be based on an
incomplete picture — see "Auth architecture — current understanding" below for what's actually
true. Two live issues were found and fixed instead:

### 1. Sync-direction binding hole (fixed, both repos)
`syncData` sent `?external_user_id=<uuid>` for all auth modes (added in PR #27). The learn
platform's `protosphere-user-data` edge function trusted that param unconditionally
(`queryUserId = externalUserId ?? userId`) instead of checking it belonged to the JWT-verified
caller. Any logged-in Protosphere user could substitute another learn user's UUID and read their
XP/streaks/duel stats/activity. Confirmed exploitable in production before the fix.

**Fix**: learn's `protosphere-sso-exchange` now persists the Protosphere-UUID ↔ learn-UUID mapping
it already computes (new `protosphere_user_map` table, migration `006_protosphere_user_map.sql` —
**not yet applied to the learn Supabase project**, see below). `protosphere-user-data` resolves the
mapping from that table by the verified JWT `sub` instead of trusting a URL param. protocode-chat's
`syncData` no longer sends the param at all (dead weight once learn ignores it).

Also removed learn's HS256 JWT fallback branch — it verified tokens against a shared secret
without ever checking `TRUSTED_ISSUERS`, a whitelist bypass independent of the sync fix.

### 2. `integrations` table leaked secrets to every client (fixed, protocode-chat, staging + prod)
Migration 050's RLS policy (`"Anyone can view enabled integrations" USING (enabled = true)`) was
row-level only, so `signing_key` and `api_key` were readable by any authenticated client doing
`select('*')` — exactly what `syncData`'s join did. `protocode-learn`'s `signing_key` had been
non-null (and therefore exposed) since someone generated it via the admin UI in anticipation of the
auth_mode flip that never happened.

**Fix** (migration `054_integrations_rls_lockdown.sql`, applied to staging + production):
- Dropped the broad SELECT policy — base table is now owner-only for reads (existing
  "Community owner can manage integrations" policy already covered this).
- Added `get_connectable_integrations(p_id)`, a `SECURITY DEFINER` function (`SET row_security =
  off`, same pattern as `handle_new_user`) returning only non-secret columns for enabled
  integrations. `syncData`, `getPublicUserData`, and the new `backend.integrations.listConnectable()`
  (used by `SettingsPage.vue`'s connect flow) all read through this instead of embedding
  `integrations(*)`.
- `protocode-learn`'s `signing_key` was nulled out — treated as compromised since it's been
  client-readable this whole time; nothing consumes it since `auth_bridge` was never activated for
  this integration.
- Verified on both environments: a non-owner authenticated session gets 0 rows from
  `select * from integrations`; `get_connectable_integrations()` still returns the safe columns.
- Staging was also missing migrations 051–053 (api_key, app_url, signing_key columns) — applied
  those to catch it up before 054.

### Learn-repo side — done (2026-08-02/04)
Migration `006_protosphere_user_map.sql` applied and both edge functions redeployed to the `learn`
project (`exrhpgesaimlgrgygawk`) — it had been paused; needed an admin to unpause via the dashboard
first. Verified live via `?schema=true`. Committed as two commits on a fresh
`fix/protosphere-user-map-binding` branch (based off `development`, not the unrelated
`feature/design-overhaul-guide` branch it was first drafted on) and merged via
[PR #17](https://github.com/prototowb/protocode-learn/pull/17). Nothing outstanding on that side.

---

## Auth architecture — current understanding (corrects the 2026-06-04/05 plan)

**Cross-platform login already works today** and doesn't need the auth_bridge cutover the prior
session planned:
- protocode-chat's `makeHybridStorage` (`src/lib/supabase.ts`) writes the session to a
  `.protocode.xyz` cookie.
- protocode-learn's `src/lib/auth-bridge.ts` (`initFromProtosphere`) reads that cookie and calls
  its own `protosphere-sso-exchange` edge function, which verifies the Protosphere access token via
  JWKS (asymmetric, no shared secret) and mints a learn-native session, mirroring the UUID where
  possible.
- This matches the product vision (Protosphere as the identity provider, one account, each platform
  keeps its own data) and is live and wired into learn's client. Previously undocumented on the
  protocode-chat side — that gap is what caused the prior session to plan around the wrong flow.

**`auth_bridge`** (protocode-chat's `/auth/bridge` route, `signing_key`/HMAC JWT verification) is
**unreachable in production** — the only configured integration (`protocode-learn`) has `auth_mode
= 'same_domain_cookie'`, so `handleValidate` rejects it outright. It's also the wrong direction for
the vision (learn asserts identity → Protosphere provisions, the reverse of "auth via Protosphere").
**Do not pursue the auth_mode flip to `auth_bridge`** — it was the prior session's plan and is now
considered dead. If `auth_bridge` code is ever cleaned up/removed, that's a separate, low-priority
task.

---

## Cross-subdomain SSO (cookie layer)

`src/lib/supabase.ts` — `makeHybridStorage`: when on `*.protocode.xyz`, writes session to both `localStorage` (origin-scoped) AND a compact cookie at `.protocode.xyz`. Sibling subdomains read the cookie to restore the session.

- Cookie key: `sb-porlhhdajfaamvggcrbi-auth-token` (derived from production Supabase URL)
- Cookie value: full session JSON minus `identities`, `user_metadata`, `app_metadata` (~1.2 KB)
- `typescript.protocode.xyz` (protocode-learn) already reads this cookie via `src/lib/auth-bridge.ts` — this piece is done, not still-needed as previously noted.

---

## MCP access

`.mcp.json` defines `supabase-chat-prod` and `supabase-chat-staging` HTTP MCP servers, scoped to
protocode-chat's two Supabase projects only — no MCP/CLI access to protocode-learn's Supabase
project from this session. Requires `SUPABASE_CHAT_TOKEN` (Supabase personal access token) in the
OS environment — set via Windows System Properties. Claude Code must be started **after** the env
var is set for the MCP to connect.
