# Building an Integration for Protosphere

This guide explains how to connect an external app to Protosphere so that user data from your app appears on Protosphere profiles.

---

## How It Works

1. **Admin registers your app** in Protosphere's dashboard (Admin > Integrations)
2. **Admin imports your fields** by fetching your API's response schema
3. **Users connect** their accounts from Settings > Connected Integrations
4. **Protosphere pulls data** from your API endpoint on a configurable TTL schedule
5. **Users control visibility** of each field (public / private / hidden)

Protosphere never pushes data to your app. It only reads.

---

## What You Need to Build

A single HTTP endpoint that returns the current user's data in a standardised JSON format.

### Endpoint Requirements

| Requirement | Detail |
|---|---|
| Method | `GET` |
| Auth | Accept a `Bearer <jwt>` token in the `Authorization` header |
| Response | JSON object with a `fields` key (see below) |
| CORS | Must allow requests from your Protosphere instance's origin |

### Auth Modes

Protosphere supports three auth modes. Choose the one that fits your setup:

| Mode | When to use | How it works |
|---|---|---|
| `same_domain_cookie` | Both apps share a parent domain (e.g. `*.protocode.xyz`) and a Supabase JWT secret | Protosphere sends the user's session JWT as `Bearer` token. Your endpoint validates it with the shared secret. |
| `oauth_redirect` | Your app has its own OAuth flow | User is redirected to your app to authorize, then back to Protosphere. *(Future — not yet implemented)* |
| `token_exchange` | No shared auth | User manually pastes a token from your app into Protosphere. Protosphere sends it as `Bearer` token. |

For **same_domain_cookie** (recommended for same-infrastructure apps):
- Both Supabase projects must share the same JWT secret
- Protosphere sends the user's existing session `access_token`
- Your endpoint calls `supabase.auth.getUser(jwt)` to identify the caller
- No extra login step for the user

---

## Response Format

Your endpoint must return a JSON object with a top-level `fields` key. Each field is keyed by a unique identifier and contains `label`, `type`, and `value`.

```json
{
  "schema_version": "1.0",
  "user_id": "uuid",
  "fields": {
    "xp": {
      "label": "Total XP",
      "type": "number",
      "value": 4250
    },
    "level": {
      "label": "Level",
      "type": "number",
      "value": 12
    },
    "course_progress": {
      "label": "Course Progress",
      "type": "list",
      "value": [
        { "name": "Basics", "progress": 1.0 },
        { "name": "Functions", "progress": 0.6 }
      ]
    },
    "recent_activity": {
      "label": "Recent Activity",
      "type": "activity_feed",
      "value": [
        { "text": "Completed lesson: Closures", "at": "2026-04-28T14:30:00Z" },
        { "text": "Earned 50 XP", "at": "2026-04-28T14:25:00Z" }
      ]
    }
  }
}
```

### Field Types

| Type | Value format | Rendered as |
|---|---|---|
| `number` | `number` | Formatted number with label (e.g. "4,250 XP") |
| `text` | `string` | Plain text |
| `badge` | `string` | Colored pill/chip |
| `progress_bar` | `number` (0-1) | Percentage bar with label |
| `list` | `Array<{ name: string; progress?: number; xp?: number }>` | List of items, optionally with progress bars |
| `activity_feed` | `Array<{ text: string; at: string; xp?: number }>` | Timestamped activity entries |

Unrecognized field types are rendered as plain text. The admin will see a warning during schema import if any fields use unknown types.

### Schema Discovery

When an admin clicks **"Fetch from API"** in the Protosphere integration dashboard, Protosphere calls your data endpoint and reads the `fields` object. The `label` and `type` of each field are extracted and presented to the admin as selectable options. This means:

- Your endpoint doubles as both a data source and a schema definition
- The admin doesn't need to manually configure field keys, labels, or types
- Fields not selected by the admin are ignored
- Unknown field types are flagged and defaulted to `text`
- If your endpoint is unreachable, admins can still add fields manually

---

## Example: Supabase Edge Function

If your app runs on Supabase, the simplest approach is a Deno Edge Function:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const jwt = authHeader.slice(7)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  )

  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Fetch your app's data for this user
  const { data: profile } = await supabase
    .from('profiles')
    .select('xp, level')
    .eq('id', user.id)
    .single()

  return new Response(JSON.stringify({
    schema_version: '1.0',
    user_id: user.id,
    fields: {
      xp: { label: 'Total XP', type: 'number', value: profile?.xp ?? 0 },
      level: { label: 'Level', type: 'number', value: profile?.level ?? 1 },
    },
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
```

For a complete real-world example, see the TypeScript learning platform integration: `supabase/functions/protosphere-user-data/index.ts` in the [code-lang-learning](https://github.com/prototowb/code-lang-learning) repo.

---

## Admin Setup (Protosphere Side)

Once your endpoint is live:

1. Go to **Admin > Integrations > Add Integration**
2. Fill in:
   - **Name**: your app's display name
   - **Slug**: URL-safe identifier (auto-generated)
   - **API Base URL**: your app's base URL (e.g. `https://learn.protocode.xyz`)
   - **Data Endpoint**: path to the endpoint (e.g. `/functions/v1/protosphere-user-data`)
   - **Auth Mode**: select the matching mode
   - **Cache TTL**: how often to re-fetch (default: 300s)
3. Click **Create Integration**
4. Open the integration detail page
5. Click **"Fetch from API"** to discover fields, select the ones to display, and click **Import**
6. **Enable** the integration

Users will now see a "Connect" button in their Settings page.

---

## Visibility Layers

Protosphere has three layers of visibility control:

1. **Admin** defines which fields exist (via the integration dashboard)
2. **Users** control per-field visibility: `public` (visible to everyone), `private` (visible only to themselves), or `hidden` (not shown at all)
3. **Space admins** can recommend specific integrations for their spaces (informational banners, not blocking)

---

## Data Flow

```
Your App's DB
     |
     v
Your API Endpoint  <---(GET + Bearer JWT)---  Protosphere Backend
                                                     |
                                                     v
                                              user_integrations.synced_data (JSONB cache)
                                                     |
                                                     v
                                              Profile UI (filtered by visibility)
```

- Protosphere pulls on first view and whenever the cache TTL expires
- Users can also manually trigger a sync from Settings
- Cached data is stored as JSONB in `user_integrations.synced_data`
- Protosphere never modifies your data

---

## Local Development Testing

Both Supabase instances run locally with the same default JWT secret, so JWTs are cross-compatible. However, `auth.users` tables are separate — a Protosphere user doesn't automatically exist in the integration's database.

### Setup

1. Start both local Supabase instances and both dev servers
2. Register/login on Protosphere (note your user UUID from Supabase Studio or browser DevTools)
3. **Seed test data** in the learning platform for your Protosphere UUID:
   ```bash
   cd code-lang-learning/typescript
   npx tsx scripts/seed-protosphere-user.ts <your-protosphere-uuid>
   ```
4. In Protosphere admin, register the integration:
   - **API Base URL**: `http://127.0.0.1:54331`
   - **Data Endpoint**: `/functions/v1/protosphere-user-data`
   - **API Key**: the learning platform's publishable key (from `supabase status`)
   - **Auth Mode**: Same Domain Cookie
5. Click **"Fetch from API"** to import fields, then **Enable**
6. In Protosphere user Settings, click **Connect**, then **Sync**

### Seamless Dev Auth (One-Click "Open")

Once the integration is connected and has an **App URL (dev)** set (e.g. `http://localhost:5174`), a dev-only **"Open"** button appears next to the Sync button in Settings. Clicking it opens:

```
{app_url}/dev/auth?user_id=<your-protosphere-uuid>
```

This automatically authenticates you on the external app as the same Protosphere user. Any activity you do there will be returned by the integration API on your next sync.

The "Open" button is tree-shaken from production builds via `import.meta.env.DEV`.

> See [DEV_AUTH_CONTRACT.md](./DEV_AUTH_CONTRACT.md) for the full contract that external apps must implement to support this flow.

---

## Database Tables (Reference)

These tables are created by migration `050_integrations.sql`:

| Table | Purpose |
|---|---|
| `integrations` | Registered external apps (name, URL, auth mode, TTL) |
| `integration_field_schemas` | Fields defined per integration (key, label, type, visibility default) |
| `user_integrations` | Per-user connections (cached synced_data, synced_at) |
| `user_field_visibility` | Per-user, per-field visibility overrides |
| `space_integration_requirements` | Per-space recommended integrations |
