# Session Handoff

> **Rolling document.** Replace contents each session — this is "what the next session needs to know," not a permanent log. For long-term project state, see `PROJECT_STATUS.md`.

**Updated**: 2026-06-02
**Last session focus**: TDD/DDD foundation + dev env toolchain

---

## What shipped this session

All work landed on `development` (merged from `docs/session-handoff`).

### Testing infrastructure
- **260 tests, all green.** `npm run test:unit` (lib-only, ~700ms) / `npm run test:run` (full, ~3s) / `npm run test:ui` (browser UI)
- Vitest coverage: per-file thresholds 90–95% on domain layer; global baseline 8%
- 8 new test files in `src/test/lib/`: automod, permissions, formatters, mentions, unread, messageSearch, roles, mutes, backend-contract (49 contract tests covering auth, community, invites, profiles, servers, channels, members, messages)

### DDD domain extractions (composables/stores → lib/)
All violations listed in `docs/DDD_CONVENTIONS.md` resolved:

| New lib function | Extracted from |
|---|---|
| `resolveEffectivePermissions()` in `permissions.ts` | `usePermissions.ts` |
| `isChannelUnread()` in `unread.ts` | `useUnread` + `useDmUnread` (de-duped) |
| `TYPING_EXPIRE_MS` / `STOP_AFTER_MS` in `typing.ts` | `useTyping.ts` |
| `messageMatchesQuery()` in `messageSearch.ts` | `useMessageSearch.ts` |
| `roleUpdateAuditAction()` in `roles.ts` | `useRoles.ts` |
| `isMuteActive()` in `mutes.ts` | `stores/mutes.ts` |

### Dev env toolchain
- **ESLint**: `eslint.config.ts` (flat config); `npm run lint` / `npm run lint:fix`; 0 errors, 6 warnings (all `v-html` — intentional)
- **@vitest/ui**: `npm run test:ui` launches browser test dashboard
- **Pre-commit hook**: `simple-git-hooks` + `lint-staged` — ESLint runs on staged `.ts`/`.vue` before every commit
- **CI quality gate**: `.github/workflows/quality.yml` — lint → type-check → tests on every push/PR to development
- **VS Code**: `.vscode/settings.json` (ESLint + Vitest integration, TypeScript workspace SDK); `.vscode/extensions.json` (Volar, ESLint, Vitest Explorer)

### Bug fixed
- `local.ts` `community_invites.create()` — `single_use` invites now set `max_uses: 1` so `validate()` returns null after use

---

## Active / pending

- **Push to remote**: `development` is ahead of `origin/development` — push when ready to trigger CI
- **PR #24** (from previous session) — `dist/` untracking — check if still open / needs rebase
- **Backend contract test**: covers local backend; Supabase extension is documented in comments but requires a test fixture
- **`any` warnings** (6 remaining `vue/no-v-html`): intentional — `v-html` used for markdown with DOMPurify-style sanitization in `renderMessage()`; warnings serve as a reminder

## Quality baseline (as of this session)
```
npm run test:run   → 260 passed (26 files)
npm run type-check → clean
npm run lint       → 0 errors, 6 warnings (v-html only)
```

---

## Conventions established / reinforced this session

### Testing
- `src/test/lib/` — pure domain function tests (no Vue, no mocks, <800ms)
- Mock ALL composables that transitively import `@/lib/backend` to prevent Supabase client initialization
- When mocking composables returning `Ref<T>`, use async factory + `await import('vue')` to get real `ref()` — plain `{ value: [] }` breaks Vue template auto-unwrap

### DDD layering
- `lib/` = domain (pure functions, types, Backend contract)
- `composables/` = application layer (no domain logic)
- `stores/` = state only (no business logic, no backend calls)
- See `docs/DDD_CONVENTIONS.md` for the layer map

### ESLint
- `eslint.config.ts` (flat config, ESLint 9)
- HTML formatting rules disabled (project uses compact style)
- `type` imports enforced via `consistent-type-imports`
- `script-setup` SFC style enforced

### Supabase MCP
- Per-repo `.mcp.json` (gitignored); `Authorization: Bearer ${SUPABASE_CHAT_TOKEN}` header
- Two servers: `supabase-chat-prod` (porlhhdajfaamvggcrbi) and `supabase-chat-staging` (pysitxxjzejhvkawacit)
- Set tokens at Windows User scope; launch Claude Code from fresh PowerShell

---

## How to use this file
- **End of session**: replace contents with new state. Keep it short (~150 lines max).
- **Start of next session**: read this file first.
- **Don't append history** — `git log` is the audit trail.
