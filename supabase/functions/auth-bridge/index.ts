import { createClient } from '@supabase/supabase-js'
import * as jose from 'jose'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function errorResponse(error: string, status: number) {
  return jsonResponse({ error }, status)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const { action } = body

  if (action === 'validate') {
    return handleValidate(supabaseAdmin, body)
  } else if (action === 'complete') {
    return handleComplete(supabaseAdmin, body)
  } else {
    return errorResponse('Invalid action. Expected "validate" or "complete"', 400)
  }
})

// ── Validate: decode JWT, look up user, return session or new_user info ───

async function handleValidate(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const token = body.token as string | undefined
  if (!token) {
    return errorResponse('Missing "token" field', 400)
  }

  // 1. Decode JWT header+payload without verification to extract `iss`
  let claims: { sub: string; iss: string; email: string; display_name: string; exp: number }
  try {
    const decoded = jose.decodeJwt(token)
    claims = decoded as typeof claims
  } catch {
    return errorResponse('Malformed JWT', 400)
  }

  if (!claims.sub || !claims.iss || !claims.email) {
    return errorResponse('JWT missing required claims (sub, iss, email)', 400)
  }

  // 2. Look up integration by slug (iss)
  const { data: integration, error: intError } = await admin
    .from('integrations')
    .select('*')
    .eq('slug', claims.iss)
    .eq('enabled', true)
    .maybeSingle()

  if (intError) {
    return errorResponse('Database error looking up integration', 500)
  }
  if (!integration) {
    return errorResponse(`Integration '${claims.iss}' not found or disabled`, 404)
  }
  if (integration.auth_mode !== 'auth_bridge') {
    return errorResponse(`Integration '${claims.iss}' does not use auth_bridge mode`, 400)
  }
  if (!integration.signing_key) {
    return errorResponse(`Integration '${claims.iss}' has no signing key configured`, 400)
  }

  // 3. Verify JWT signature (HMAC-SHA256)
  try {
    const secret = new TextEncoder().encode(integration.signing_key)
    await jose.jwtVerify(token, secret, { algorithms: ['HS256'] })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    if (message.includes('expired')) {
      return errorResponse('Token expired', 401)
    }
    return errorResponse('Invalid token signature', 401)
  }

  // 4. Look up existing link by (integration_id, external_user_id)
  const { data: existingLink } = await admin
    .from('user_integrations')
    .select('user_id')
    .eq('integration_id', integration.id)
    .eq('external_user_id', claims.sub)
    .maybeSingle()

  if (existingLink) {
    // Existing user — generate session
    const session = await generateSession(admin, existingLink.user_id)
    if (!session) {
      return errorResponse('Failed to generate session for linked user', 500)
    }
    return jsonResponse({
      status: 'logged_in',
      session,
    })
  }

  // 5. New user — return temp_token with claims for onboarding UI
  const jwtSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const tempSecret = new TextEncoder().encode(jwtSecret)
  const tempToken = await new jose.SignJWT({
    purpose: 'bridge_registration',
    sub: claims.sub,
    iss: claims.iss,
    email: claims.email,
    display_name: claims.display_name || '',
    integration_id: integration.id,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('10m')
    .sign(tempSecret)

  const suggested = claims.display_name
    ? claims.display_name.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 32)
    : claims.email.split('@')[0].replace(/[^a-z0-9_]/g, '_').slice(0, 32)

  return jsonResponse({
    status: 'new_user',
    temp_token: tempToken,
    suggested_username: suggested,
    email: claims.email,
    display_name: claims.display_name || '',
    integration_slug: claims.iss,
    external_user_id: claims.sub,
  })
}

// ── Complete: create user, link integration, return session ───────────────

async function handleComplete(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const tempToken = body.temp_token as string | undefined
  const username = body.username as string | undefined

  if (!tempToken || !username) {
    return errorResponse('Missing "temp_token" or "username"', 400)
  }

  // Validate username format
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
    return errorResponse('Username must be 3-32 characters, letters/numbers/underscores only', 400)
  }

  // Verify temp_token
  const jwtSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const secret = new TextEncoder().encode(jwtSecret)

  let claims: { purpose: string; sub: string; iss: string; email: string; display_name: string; integration_id: string }
  try {
    const { payload } = await jose.jwtVerify(tempToken, secret, { algorithms: ['HS256'] })
    claims = payload as unknown as typeof claims
  } catch {
    return errorResponse('Invalid or expired registration token', 401)
  }

  if (claims.purpose !== 'bridge_registration') {
    return errorResponse('Invalid token purpose', 400)
  }

  // Check if username is already taken
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (existingProfile) {
    return errorResponse('Username is already taken', 409)
  }

  // Check if email is already in use
  const { data: existingUsers } = await admin.auth.admin.listUsers()
  const emailTaken = existingUsers?.users?.some(
    (u: { email?: string }) => u.email?.toLowerCase() === claims.email.toLowerCase(),
  )
  if (emailTaken) {
    return errorResponse(
      'An account with this email already exists. Log in normally and connect the integration from Settings.',
      409,
    )
  }

  // Create auth user — handle_new_user trigger creates the profile
  const password = crypto.randomUUID() + crypto.randomUUID()
  const { data: createData, error: createError } = await admin.auth.admin.createUser({
    email: claims.email,
    password,
    email_confirm: true,
    user_metadata: {
      username,
      display_name: claims.display_name || username,
    },
  })

  if (createError || !createData.user) {
    return errorResponse(
      createError?.message || 'Failed to create user account',
      500,
    )
  }

  const userId = createData.user.id

  // Link integration with external_user_id
  const { error: linkError } = await admin
    .from('user_integrations')
    .insert({
      user_id: userId,
      integration_id: claims.integration_id,
      external_user_id: claims.sub,
      connected_at: new Date().toISOString(),
    })

  if (linkError) {
    // Non-fatal: user was created, they can link from Settings later
    console.error('Failed to link integration:', linkError.message)
  }

  // Generate session for the new user
  const session = await generateSession(admin, userId)
  if (!session) {
    return errorResponse('Account created but session generation failed. Please log in normally.', 500)
  }

  return jsonResponse({ session })
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function generateSession(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ access_token: string; refresh_token: string } | null> {
  // Get user's email to generate a magic link
  const { data: { user }, error } = await admin.auth.admin.getUserById(userId)
  if (error || !user?.email) return null

  // Generate magic link → extract hashed token → verify OTP → get session
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
  })
  if (linkError || !linkData) return null

  const { data: verifyData, error: verifyError } = await admin.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  })
  if (verifyError || !verifyData.session) return null

  return {
    access_token: verifyData.session.access_token,
    refresh_token: verifyData.session.refresh_token,
  }
}
