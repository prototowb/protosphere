# Session Handoff

> **Rolling document.** Replace contents each session — this is "what the next session needs to know," not a permanent log. For long-term project state, see `PROJECT_STATUS.md`.

**Updated**: 2026-06-02
**Last session focus**: TDD/DDD foundation + dev env toolchain + Supabase integration tests

---

## What shipped this session

All work is on `development`, pushed to origin.

### Testing infrastructure
| Script | What it runs |
|---|---|
| `npm run test:unit` | lib-only pure tests, ~700ms |
| `npm run test:run` | full unit suite, ~3s |
| `npm run test:ui` | browser Vitest UI |
| `npm run test:coverage` | with per-file thresholds on domain layer |
| `npm run test:integration` | Supabase integration suite (needs `supabase start`) |

**Unit suite**: 260 tests, 26 files, all green.

**Integration suite**: 18 tests against live local Supabase — auth, profile trigger, community bootstrap, servers, messages, RLS. Run after `supabase start`; the global setup calls `supabase db reset` automatically.

### DDD domain extractions (composables/stores → lib/)
All violations from `docs/DDD_CONVENTIONS.md` resolved:

| lib/ function | Extracted from |
|---|---|
| `resolveEffectivePermissions()` in `permissions.ts` | `usePermissions.ts` |
| `isChannelUnread()` in `unread.ts` | `useUnread` + `useDmUnread` (de-duped) |
| `TYPING_EXPIRE_MS` / `STOP_AFTER_MS` in `typing.ts` | `useTyping.ts` |
| `messageMatchesQuery()` in `messageSearch.ts` | `useMessageSearch.ts` |
| `roleUpdateAuditAction()` in `roles.ts` | `useRoles.ts` |
| `isMuteActive()` in `mutes.ts` | `stores/mutes.ts` |

### Dev env toolchain
- **ESLint**: `eslint.config.ts` (flat config, ESLint 9); `npm run lint` / `lint:fix`; 0 errors, 6 warnings (all intentional `v-html`)
- **Pre-commit hook**: `simple-git-hooks` + `lint-staged` — ESLint on staged `.ts`/`.vue` before every commit
- **CI quality gate**: `.github/workflows/quality.yml` — lint → type-check → tests on every push/PR to `development`
- **VS Code**: `.vscode/settings.json` (ESLint + Vitest integration, TypeScript workspace SDK); `.vscode/extensions.json` (Volar, ESLint, Vitest Explorer)
- **`@vitest/ui`**: `npm run test:ui` for browser test dashboard

### Bugs found and fixed
- `local.ts` `community_invites.create()` — `single_use` invites now set `max_uses: 1` (validate was not returning null after use)
- `supabase-backend.ts` `servers.create()` — now generates `invite_code` (was null)
- `supabase-backend.ts` `createSupabaseBackend()` — accepts optional injected `SupabaseClient` for DI in tests
- `supabase-backend.ts` `reports.list` / `mutes.list` — replaced `(data as any[])` with typed intersection types (`RawReport`, `RawMute`)
- `supabase.ts` — `window.location?.hostname` null-safety guard (was crashing in happy-dom test environment)

### Housekeeping
- Merged PR #24 (`dist/` untracking) — `dist/` is now completely untracked from source branches
- `development` is fully pushed to origin

---

## Quality baseline
```
npm run test:run        → 260 passed (26 files), ~3s
npm run test:integration → 18 passed (needs supabase start)
npm run type-check      → clean
npm run lint            → 0 errors · 6 warnings (vue/no-v-html, intentional)
```

---

## Active / pending

- No open PRs
- Next feature work: no M26 planned yet — decide direction before next session (see PROJECT_STATUS.md for candidates: notifications, forum improvements, search, mobile/PWA)
- Integration test suite does NOT run in CI (Supabase not available in GitHub Actions) — run manually before significant DB schema changes

---

## Conventions

### Testing
- `src/test/lib/` — pure domain tests, no mocks, no Vue
- `src/test/integration/` — live Supabase tests; `makeBackend()` creates a fresh client per test; `currentUserId()` reads from live session
- When mocking composables returning `Ref<T>`, use async factory + `await import('vue')` — plain `{ value: [] }` breaks Vue template auto-unwrap
- Mock ALL composables that transitively import `@/lib/backend` to prevent Supabase client initialization in unit tests

### DDD layering
- `lib/` = domain (pure functions, types, Backend contract)
- `composables/` = application layer (no domain logic, delegates to lib/)
- `stores/` = state only (no business logic)
- See `docs/DDD_CONVENTIONS.md` — all listed violations resolved

### ESLint
- Flat config (`eslint.config.ts`, ESLint 9)
- HTML formatting rules disabled (compact style is intentional)
- `consistent-type-imports` + `script-setup` enforced
- Test files: `no-explicit-any`, `no-floating-promises`, `no-console` all off

### Supabase username constraint
- `^[a-zA-Z0-9_]{3,32}$` — no hyphens, no dots; test usernames must follow this format
- `handle_new_user` trigger uses `raw_user_meta_data->>'username'` from `signUp()` options

### Supabase MCP
- Per-repo `.mcp.json` (gitignored); `Authorization: Bearer ${SUPABASE_CHAT_TOKEN}`
- Two servers: prod (`porlhhdajfaamvggcrbi`) and staging (`pysitxxjzejhvkawacit`)
- Set tokens at Windows User scope; launch Claude Code from fresh PowerShell

---

## How to use this file
- **End of session**: replace contents with new state. Keep it under ~150 lines.
- **Start of next session**: read this file first.
- **Don't append history** — `git log` is the audit trail.
