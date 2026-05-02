# Dev Auth Contract for Integrations

This document describes the contract that external apps must implement to support Protosphere's one-click dev auth flow.

---

## Overview

In local development, Protosphere can open your app and automatically authenticate the user — no manual UUID copying required. The user clicks **"Open"** on a connected integration in Settings, and your app receives the Protosphere user ID, mints a local session, and redirects to your app's main page.

This flow is **dev-only**. It does not exist in production builds.

---

## What You Need to Implement

### Endpoint

| Field | Value |
|---|---|
| Route | `GET /dev/auth` |
| Query param | `user_id` — the Protosphere user's UUID |
| Behavior | Create or find the user in your local auth system, establish a session, redirect to your app |
| Environment | Only exposed in local dev builds |

### Flow

```
Protosphere Settings
  → User clicks "Open" on connected integration
  → Browser opens: {app_url}/dev/auth?user_id={uuid}
  → Your app mints a session for that UUID
  → Redirect to your app's main page (user is now logged in)
```

---

## Implementation Examples

### Supabase Edge Function Approach

If your app uses Supabase, create a `dev-sign-in` edge function:

```typescript
// supabase/functions/dev-sign-in/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { user_id } = await req.json()
  if (!user_id) {
    return new Response(JSON.stringify({ error: 'user_id required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // Get user's email to generate a magic link
  const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(user_id)
  if (error || !user?.email) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Generate magic link and extract token_hash
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
  })
  if (linkError || !linkData) {
    return new Response(JSON.stringify({ error: 'Failed to generate link' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify OTP to get session tokens
  const { data: session, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  })
  if (verifyError || !session.session) {
    return new Response(JSON.stringify({ error: 'Failed to verify OTP' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({
    session: {
      access_token: session.session.access_token,
      refresh_token: session.session.refresh_token,
    },
    user_id,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
```

Then create a frontend page at `/dev/auth`:

```typescript
// src/pages/DevAuthPage.vue (or equivalent)
const userId = new URLSearchParams(window.location.search).get('user_id')

const response = await fetch(`${SUPABASE_URL}/functions/v1/dev-sign-in`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
  },
  body: JSON.stringify({ user_id: userId }),
})

const { session } = await response.json()
await supabase.auth.setSession(session)
// Redirect to main app
router.push('/')
```

**Important:** Disable JWT verification for this function in `supabase/config.toml`:

```toml
[functions.dev-sign-in]
verify_jwt = false
```

### Generic (Non-Supabase) Approach

If your app doesn't use Supabase:

```javascript
// GET /dev/auth?user_id=<uuid>
app.get('/dev/auth', (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).send('Not found')
  }

  const { user_id } = req.query
  if (!user_id) return res.status(400).send('user_id required')

  // Find or create user in your system
  let user = db.users.findById(user_id)
  if (!user) {
    user = db.users.create({ id: user_id, email: `${user_id}@dev.local` })
  }

  // Mint a session (JWT, cookie, etc.)
  const token = jwt.sign({ sub: user_id }, process.env.SESSION_SECRET)
  res.cookie('session', token, { httpOnly: true })
  res.redirect('/')
})
```

---

## Registering with Protosphere

1. In Protosphere Admin > Integrations, create or edit your integration
2. Set the **App URL (dev)** field to your local dev server URL (e.g. `http://localhost:5174`)
3. Protosphere will construct the URL as: `{app_url}/dev/auth?user_id={current_user_uuid}`

The "Open" button only appears:
- In development builds (`import.meta.env.DEV === true`)
- When the integration has an `app_url` set
- When the user has connected the integration

---

## Prerequisites

For the full flow to work, the user UUID must exist in your app's database. Options:

1. **Seed script** — Create a script that inserts a user record given a UUID:
   ```bash
   npx tsx scripts/seed-protosphere-user.ts <uuid>
   ```

2. **Auto-create on first auth** — Your `/dev/auth` handler creates the user if it doesn't exist.

3. **Shared auth** — If both apps share a Supabase instance (same-domain deployments), the user already exists.

---

## Security Notes

- The `/dev/auth` endpoint must NEVER be exposed in production
- Gate it behind `NODE_ENV === 'development'` or equivalent
- Vite apps: use `import.meta.env.DEV` (tree-shaken from production builds)
- The Protosphere "Open" button is also dev-only (gated by `import.meta.env.DEV`)
