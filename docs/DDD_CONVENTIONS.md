# DDD Conventions — protocode-chat

## Pattern Summary

This codebase follows a lightweight DDD-inspired layering without ceremony:
**`src/lib/`** is the domain layer — pure functions, types, and the Backend contract (repository pattern).
**`src/composables/`** is the application layer — reactive glue that calls the backend, manages loading state, and wires UI interactions to domain operations.
**`src/stores/`** is the state layer — Pinia stores that composables read and write.
**`src/components/` and `src/pages/`** are the presentation layer — should contain no business logic.
The `Backend` interface in `src/lib/backend/types.ts` is the repository contract; `local.ts` and `supabase-backend.ts` are its implementations. All composables access data through this abstraction.

## Layer Map

| Layer | Location | Belongs Here |
|---|---|---|
| Domain types | `src/lib/types.ts` | Entity shapes, value type aliases, discriminated unions |
| Domain services | `src/lib/*.ts` | Pure functions: `checkAutomod`, `hasPermission`, `computePermissions`, `renderMessage`, `escapeHtml` |
| Repository contract | `src/lib/backend/types.ts` | The `Backend` interface — one stable contract for all backends |
| Repository implementations | `src/lib/backend/local.ts`, `supabase-backend.ts` | Concrete data access, no business logic |
| Application services | `src/composables/` | Backend calls + reactive state management; no direct data access |
| State | `src/stores/` | Pinia stores; no backend calls, no business logic |
| Presentation | `src/components/`, `src/pages/` | Template + v-model only; reads from composables/stores |

## Violations to Fix (Prioritized)

### HIGH — usePermissions.ts: permission resolution logic

**Current state:** `usePermissions.ts:26-41` contains a multi-branch resolution algorithm (check custom roles → deserialize → compute; fallback to legacy role string → call `legacyRoleToPermissions`). This is domain logic — it answers "what are this user's effective permissions?" — wrapped in a computed ref.

**What to extract:** A pure function `resolveEffectivePermissions(userRoles: Role[], legacyRole?: string): PermissionBits` in `src/lib/permissions.ts`. The composable then becomes a thin wrapper that feeds store data into this function.

**Why it matters:** The resolution logic is currently untestable without mounting a Pinia app. As a pure function in `lib/`, it gets a unit test in seconds.

```ts
// src/lib/permissions.ts (addition)
export function resolveEffectivePermissions(
  userRoles: { permissions: string }[],
  legacyRole?: string,
): PermissionBits {
  if (userRoles.length > 0) {
    return computePermissions(userRoles.map((r) => deserializePermissions(r.permissions)))
  }
  if (legacyRole) return legacyRoleToPermissions(legacyRole)
  return 0n
}
```

---

### HIGH — useUnread.ts / useDmUnread.ts: near-duplicate unread predicate

**Current state:** Both files contain an inline predicate: "is there a message from someone else newer than the last-read timestamp?" The logic is duplicated across the two composables with minor variations.

**What to extract:** A pure function `isChannelUnread(messages: { author_id: string; created_at: string }[], lastReadIso: string | undefined, currentUserId: string): boolean` in `src/lib/unread.ts`.

**Why it matters:** The predicate is a business rule ("what counts as unread"), not a Vue concern. It should be independently testable and have a single authoritative definition.

```ts
// src/lib/unread.ts (new file)
export function isChannelUnread(
  messages: { author_id: string; created_at: string }[],
  lastReadIso: string | undefined,
  currentUserId: string,
): boolean {
  const othersMessages = messages.filter((m) => m.author_id !== currentUserId)
  if (othersMessages.length === 0) return false
  if (!lastReadIso) return true
  return othersMessages.some((m) => m.created_at > lastReadIso)
}
```

---

### MEDIUM — useTyping.ts: timing constants as magic numbers

**Current state:** `TYPING_EXPIRE_MS = 2000` and `STOP_AFTER_MS = 1500` are module-level constants in `useTyping.ts`. They define protocol behavior ("a typing indicator expires after 2s") but are invisible outside the composable.

**What to extract:** Export them from `src/lib/typing.ts` so they can be referenced in tests and in the realtime typing subsystem (`useRealtime.ts`) without importing a composable.

```ts
// src/lib/typing.ts (new file)
export const TYPING_EXPIRE_MS = 2000
export const STOP_AFTER_MS = 1500
```

---

### MEDIUM — useMessageSearch.ts: client-side filter predicate

**Current state:** `useMessageSearch.ts:46-49` contains `m.content.toLowerCase().includes(lower)` inline in a `watch`. This is a business rule ("does a message match a query?") embedded in reactive infrastructure.

**What to extract:** `src/lib/messageSearch.ts` with `messageMatchesQuery(content: string, query: string): boolean`. Lets the filter be tested independently of Vue reactivity.

```ts
// src/lib/messageSearch.ts (new file)
export function messageMatchesQuery(content: string, query: string): boolean {
  return content.toLowerCase().includes(query.toLowerCase())
}
```

---

### LOW — useRoles.ts: audit action selection

**Current state:** Inside the `updateRole` flow, a conditional picks between `'permissions_changed'` and `'update'` as the audit log action. This is a small business rule embedded in application-layer code.

**What to do:** Extract to `src/lib/roles.ts` as `roleUpdateAuditAction(changedFields: string[]): AuditLogAction`. Low priority — the rule is trivial and unlikely to diverge.

---

## What NOT to extract

- Store actions that call `backend.*` — those are application layer and belong in composables/stores.
- Loading state, error state, reactive refs — all presentation/application concerns.
- The `Backend` interface itself — it's already the repository contract, no further abstraction needed.
- `useAuth.ts`, `useMessages.ts`, etc. — orchestration composables with no extractable domain logic.
