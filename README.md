# Protosphere

A single-community chat platform built with Vue 3, Supabase, and Tailwind CSS 4. Supports public spaces, private areas, real-time messaging, moderation tools, polls, events, and a first-class forum system with a block-editor for long-form posts and personal profile pages.

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

## Integrations

Protosphere has a generic integrations framework for connecting external apps. Admins register integrations via the dashboard, users link their accounts and control what data is visible on their profile.

**Auth Bridge** — integrations using the `auth_bridge` mode support one-click federated login: your app signs a short-lived JWT with a shared secret and redirects the user to `/auth/bridge?token=<jwt>`. Protosphere validates the signature, finds or creates the account, and logs them in automatically.

See **[INTEGRATIONS.md](INTEGRATIONS.md)** for the full guide, including auth modes and the auth bridge JWT format.

### Testing your integration locally

To test an integration end-to-end against a local Protosphere instance:

1. **Start local Protosphere** (see [Run against local Supabase](#run-against-local-supabase) above)

2. **Start your API** on any local port. It needs one endpoint that:
   - Returns field schema on `GET ?schema=true` (no auth required)
   - Returns user data on authenticated `GET` with `Authorization: Bearer <jwt>`

3. **Verify the Protosphere JWT** in your API. Protosphere issues ES256 tokens — verify them against its JWKS endpoint:
   ```
   GET http://127.0.0.1:54321/auth/v1/.well-known/jwks.json
   ```
   The `sub` claim in the verified payload is the Protosphere user's UUID. Use that to look up the user's data in your own database.

4. **Register the integration** in Protosphere's admin panel (`/admin/integrations`):
   - API Base URL: `http://127.0.0.1:<your-port>`
   - Data Endpoint: `/your/endpoint`
   - API Key: leave blank (only needed for Supabase Edge Functions)
   - Auth Mode: Same Domain Cookie

5. **Fetch fields** with "Fetch from API", then enable the integration

6. **Connect + Sync** in Protosphere user Settings to verify data is returned correctly

---

## Project Structure

```
src/
  assets/         # Global CSS + theme tokens
  components/     # UI components (layout, messages, moderation, integrations/, ui/)
  composables/    # Vue composables (useRealtime, usePermissions, useIntegrations, etc.)
  lib/
    backend/      # Backend adapter (local.ts / supabase-backend.ts)
    permissions.ts
    types.ts
  pages/          # Route-level page components
  router.ts
  stores/         # Pinia stores
supabase/
  migrations/     # SQL migrations (001–051)
```

---

## Branching

See [BRANCHING.md](BRANCHING.md) for the full git workflow, branch naming conventions, and environment promotion rules.
