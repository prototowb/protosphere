# Session Handoff

> **Rolling document.** Replace contents each session — this is "what the next session needs to know," not a permanent log. For long-term project state, see `PROJECT_STATUS.md`.

**Updated**: 2026-06-02
**Last session focus**: TDD/DDD foundation + dev env improvements

---

## What shipped this session

### TDD/DDD infrastructure (branch: `docs/session-handoff`)

| Commit | What |
|---|---|
| `e6b4de4` | 126 lib unit tests, coverage config, 5 DDD domain function extractions |
| `da50155` | Fixed all pre-existing test failures (3 files → 0) |
| `babc118` | Coverage thresholds finalised + PROJECT_STATUS updated |

**Test suite**: 226 tests, 26 files, all green. `npm run test:unit` runs lib-only in ~700ms.

**Coverage**: Per-file thresholds on domain layer (90–95%). Global baseline at 8%/7%/10% — raise as coverage expands.

**Domain extractions (composables → lib/)**:
- `lib/permissions.ts` — added `resolveEffectivePermissions()` ← `usePermissions.ts`
- `lib/unread.ts` — new: `isChannelUnread()`, de-duped from `useUnread` + `useDmUnread`
- `lib/typing.ts` — new: `TYPING_EXPIRE_MS` / `STOP_AFTER_MS` constants
- `lib/messageSearch.ts` — new: `messageMatchesQuery()` ← `useMessageSearch.ts`
- `lib/roles.ts` — new: `roleUpdateAuditAction()` ← `useRoles.ts`

**Bug fixed**: `local.ts` `community_invites.create()` — `single_use` invites now set `max_uses: 1` so `validate()` returns null after use.

**Docs**: `docs/DDD_CONVENTIONS.md` — layer map + migration reference (all 5 listed violations resolved).

---

## Active / pending

- **Branch `docs/session-handoff`** — has the TDD/DDD commits above + the earlier docs-only commits. Consider whether to PR this into `development` or cherry-pick.
- **PR #24** (from previous session) — `dist/` untracking. Still open; check if it needs rebase.
- **Backend contract test** — `src/test/lib/backend-contract.test.ts` covers auth, community, community_invites on the local backend. Structured to extend to Supabase when a test fixture is available.
- **automod.ts line 66** — the `default:` branch is unreachable by design (TypeScript exhaustiveness check) but shows as uncovered. Not a problem; note it if the threshold starts failing.

## Conventions established / reinforced this session

### Testing
- `src/test/lib/` — pure domain function tests only (no Vue, no mocks, fast)
- `src/test/composables/` — composable tests, mocking `@/lib/backend` wholesale
- `src/test/pages/` + `src/test/components/` — component tests with `@vue/test-utils`
- When mocking composables that return `Ref<T>`, use async factory + `await import('vue')` to get real `ref()` — plain `{ value: [] }` breaks Vue template auto-unwrap
- Mock ALL composables that transitively import `@/lib/backend` to prevent Supabase client initialization in tests

### DDD layering
- `lib/` is the domain layer — pure functions, types, Backend contract
- `composables/` is the application layer — no domain logic, delegates to lib/
- See `docs/DDD_CONVENTIONS.md` for the full layer map

### Supabase MCP (unchanged)
- Per-repo `.mcp.json` (gitignored), PAT in `Authorization: Bearer ${SUPABASE_CHAT_TOKEN}` header
- Two servers: `supabase-chat-prod` (porlhhdajfaamvggcrbi) and `supabase-chat-staging` (pysitxxjzejhvkawacit)
- Set tokens at Windows User scope and launch Claude Code from a fresh PowerShell

---

## How to use this file

- **End of session**: replace the contents with the new state. Keep it short (~150 lines max).
- **Start of next session**: read this file first.
- **Don't append history** — `git log` is the audit trail. This file is "what's true right now."
