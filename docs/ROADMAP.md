<!-- proto-gear | purpose: Enhancement plan & roadmap after M25 + Integrations | read-when: Planning milestones or architecture work | priority: recommended -->
# Protosphere — Enhancements Plan & Roadmap

**Written**: 2026-11-17 (re-assessment after a ~3-month pause) · **Status**: proposal, needs maintainer sign-off
**Extends**: `PROJECT_SPECIFICATIONS.md` (vision: the central hub for one community, and the identity provider for `*.protocode.xyz`), `PROJECT_STATUS.md` (M1–M25 + Integrations complete), `docs/DDD_CONVENTIONS.md`.

---

## 1. Where the platform stands

Feature-complete through M25 with a clean architecture (composables → backend interface → local | Supabase) and a healthy unit suite. The re-assessment focused on what the feature work left behind:

- **The database should be the single enforcement point.** PTSPH-206 (migration 055) aligns several access-control policies with the features they serve; Phase 1 continues that principle for the remaining community rules.
- **Rendering user content needs one hardened path.** PTSPH-206 consolidates escaping and sanitising (`lib/formatters`, `lib/pageSanitize` on DOMPurify) with structural tests.
- **Quality gates had a hole.** CI's type-check (`vue-tsc --noEmit` against a references-only `tsconfig.json`) checked no files. Fixed: `vue-tsc -b`, Node 22, runtime `npm audit` gate.
- **Realtime/unread state is per-component and per-call**, which shows up as missing badges and stale state after account switches.

---

## 2. Vision additions

1. **Protosphere as a proper identity provider.** Today satellites read the session cookie on `.protocode.xyz`. That makes every satellite as trusted as the hub, and turns any script injection anywhere into a cross-app session leak. Target: satellites receive short-lived, *audience-scoped* tokens minted server-side ("Sign in with Protosphere"), and the shared cookie stops carrying the full session.
2. **Progress-gated study rooms.** Space integration requirements already exist; with Protocode Learn exposing tier progress, spaces like "AI Agents — Tier 3+" become community access earned by learning.
3. **Integrations v2.** Server-side sync via an Edge Function (user tokens never leave Protosphere), a host allowlist, per-integration audience tokens, and optional webhooks for real-time events (e.g. "posted a capstone").
4. **Installable PWA + web push.** Notifications currently only work while a tab is open.
5. **Moderation you can run a real community on.** Server-written audit log, report queue with states, appeals, bulk actions, rate limits.

---

## 3. Roadmap

Next free ticket: PTSPH-207.

### Phase 0 — Hardening pass ✅ (PTSPH-206, this branch)
- Content rendering: quote-safe escaping, emoji fallback rendered as text, page blocks sanitised by an allowlist (DOMPurify), URL/CSS validation for page blocks.
- Migration 055: profile/ownership/DM-membership/integration-data access tightened; filtered `get_public_user_integrations()` RPC (field visibility now enforced server-side — "Only me" fields were visible to profile viewers); reaction value constraint. Regression suite: `supabase/tests/055_access_control_hardening.sql` (runs in a rolled-back transaction on the local stack).
- Integrations: https-only targets, fetch timeout, payload validation, profile views no longer sync other users' rows.
- User-initiated sign-out performs a full client reset.
- Dependencies: runtime `npm audit` clean (resolved with a ≥2-week package-age cutoff).

### Phase 1 — Server-side enforcement
- Move the remaining community rules into the database, so the client keeps only UX hints (details tracked privately).
- Server-written audit trail.
- Retention job on `pg_cron` with failure alerting.
- Resolve the remaining Supabase security-linter items.
- One permission model shared by client and SQL.

### Phase 2 — Realtime & state
- One realtime manager: subscription lifecycle, reconnect with backfill, dedupe by id, status surfaced in UI.
- Unread + mentions in a Pinia store fed by a "latest message per channel" query, so badges and the tab title reflect every channel and DM.
- Cursor pagination for DM history (matching channel messages), members and forum lists.
- `REPLICA IDENTITY FULL` (or id-only delete handling) so remote deletes reach filtered subscribers.

### Phase 3 — Architecture
- Split `local.ts` / `supabase-backend.ts` (~2k lines each) by bounded context — identity, community, messaging, moderation, engagement, forum, integrations — composing the existing `Backend` interface.
- Run the backend contract suite against **both** backends (Supabase via the local stack) — local mode currently hides retention and enforcement differences.
- Type-check tests (`tsconfig.vitest.json`; `tsconfig.app.json` excludes `src/test/**`).
- Remove the deprecated `auth_bridge` mode (inventory in `SESSION_HANDOFF.md`; needs a forward migration and undeploying the function).
- Security headers / CSP via hosting config (`script-src 'self'`, `frame-ancestors 'none'`, HSTS).

### Phase 4 — Product
Vision items 1–5, plus the long-deferred spec items: custom emoji, user blocking, webhooks & bot API, voice (evaluate need first).

---

## 4. Cross-repo items (shared with Protocode Learn's roadmap)

| Item | Owner | Note |
|---|---|---|
| Shared session cookie model | Protosphere | Vision #1. Until then, every XSS fix in either app protects both. |
| Learn's push module stub | Both | Protosphere built pull instead. Recommendation: retire the stub; use Integrations v2 webhooks if real-time events are needed. |
| Integration payload contract | Both | Field types number/text/badge/list/activity_feed/progress_bar; learn now validates what it publishes, Protosphere validates what it stores. |
| Release discipline | Protosphere | Schema changes that tighten access must ship with (or after) the client that uses the new path. Promote `development` → `main` promptly after applying such migrations to production. |
