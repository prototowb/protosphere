# Protosphere

A single-community chat platform built with Vue 3, Supabase, and Tailwind CSS 4. Supports public spaces, private areas, real-time messaging, moderation tools, polls, events, and threaded discussions.

## Tech Stack

- **Frontend**: Vue 3 + TypeScript + Vite + Tailwind CSS 4 + Pinia + Vue Router
- **Backend**: Supabase (Postgres + Auth + Realtime + Storage)
- **Fallback**: localStorage-only mode (no Supabase required for local dev)

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
npm install
```

### Run in local-only mode (no Supabase)

No configuration needed — the app runs entirely in localStorage.

```bash
npm run dev:local
```

### Run against local Supabase

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli)
2. Start the local instance:
   ```bash
   supabase start --workdir "G:/Projects/protocode-chat"
   ```
3. Copy credentials into `.env.local`:
   ```bash
   supabase status --workdir "G:/Projects/protocode-chat"
   # copy API URL and anon key into .env.local
   ```
4. Apply migrations:
   ```bash
   supabase db reset --workdir "G:/Projects/protocode-chat"
   ```
5. Run the app:
   ```bash
   npm run dev
   ```

---

## Environment Tiers

| Environment | Supabase Project | Config File | npm script |
|-------------|-----------------|-------------|------------|
| Local | local Supabase / localStorage | `.env.local` | `npm run dev` / `npm run dev:local` |
| Staging | `protocode-chat-staging` | `.env.staging` | `npm run dev:staging` |
| Production | `protocode-chat` | CI secrets | — |

Copy `.env.example` to get the required variable names.

---

## Migration Workflow

Migrations live in `supabase/migrations/`. Always promote through all tiers — never apply directly to production.

```bash
# 1. Test locally
supabase db reset --workdir "G:/Projects/protocode-chat"

# 2. Push to staging and smoke-test
supabase db push --workdir "G:/Projects/protocode-chat"
npm run dev:staging

# 3. Push to production
supabase db push --project-ref porlhhdajfaamvggcrbi --workdir "G:/Projects/protocode-chat"
```

The Supabase CLI is linked to staging by default. Production requires the explicit `--project-ref` flag.

---

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Dev server (loads `.env.local` → Supabase mode) |
| `npm run dev:local` | Dev server in localStorage-only mode |
| `npm run dev:staging` | Dev server against staging Supabase |
| `npm run build` | Type-check + production build |
| `npm run type-check` | TypeScript check only |
| `npm run test` | Vitest in watch mode |
| `npm run test:run` | Vitest single run |
| `npm run test:coverage` | Coverage report |

---

## Project Structure

```
src/
  assets/         # Global CSS + theme tokens
  components/     # UI components (layout, messages, moderation, ui/)
  composables/    # Vue composables (useRealtime, usePermissions, etc.)
  lib/
    backend/      # Backend adapter (local.ts / supabase-backend.ts)
    permissions.ts
    types.ts
  pages/          # Route-level page components
  router.ts
  stores/         # Pinia stores
supabase/
  migrations/     # SQL migrations (001–035)
```

---

## Branching

See [BRANCHING.md](BRANCHING.md) for the full git workflow, branch naming conventions, and environment promotion rules.
