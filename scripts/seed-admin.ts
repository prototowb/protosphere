/**
 * PTSPH-155: First-user admin bootstrap for production Supabase deployments.
 *
 * Run once after initial deploy:
 *   SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-admin.ts <email>
 *
 * What it does:
 * 1. Finds the profile by email
 * 2. Seeds community_settings if not already seeded
 * 3. Assigns the Owner role in the first space (if any spaces exist)
 * 4. Sets account_status = 'active'
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const targetEmail = process.argv[2]

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

if (!targetEmail) {
  console.error('Usage: npx tsx scripts/seed-admin.ts <email>')
  process.exit(1)
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  console.log(`Seeding admin for: ${targetEmail}`)

  // 1. Find user by email (admin API)
  const { data: { users }, error: usersErr } = await client.auth.admin.listUsers()
  if (usersErr) throw usersErr
  const user = users.find((u) => u.email === targetEmail)
  if (!user) {
    console.error(`No user found with email: ${targetEmail}`)
    process.exit(1)
  }

  const userId = user.id
  console.log(`Found user: ${userId}`)

  // 2. Get or create profile
  const { data: profile, error: profileErr } = await client
    .from('profiles')
    .select('id, account_status')
    .eq('id', userId)
    .single()

  if (profileErr || !profile) {
    console.error('Profile not found. User may not have completed registration.')
    process.exit(1)
  }

  // 3. Activate account
  await client
    .from('profiles')
    .update({ account_status: 'active' })
    .eq('id', userId)
  console.log('Set account_status = active')

  // 4. Seed community_settings
  const { data: existing } = await client.from('community_settings').select('id').limit(1).single()
  if (!existing) {
    await client.from('community_settings').insert({
      name: 'My Community',
      description: 'Welcome!',
      registration_mode: 'open',
      rules: '',
      welcome_message: 'Welcome to our community!',
    })
    console.log('Seeded community_settings')
  } else {
    console.log('community_settings already exists — skipping')
  }

  // 5. Find first server's Owner role and assign it
  const { data: ownerRole } = await client
    .from('roles')
    .select('id, server_id')
    .eq('name', 'Owner')
    .eq('is_system', true)
    .limit(1)
    .single()

  if (ownerRole) {
    const { error: roleErr } = await client
      .from('user_roles')
      .upsert({ user_id: userId, role_id: ownerRole.id })
    if (roleErr) console.warn('Role assignment warning:', roleErr.message)
    else console.log(`Assigned Owner role (server: ${ownerRole.server_id})`)

    // Legacy member role update
    await client
      .from('members')
      .update({ role: 'owner' })
      .eq('user_id', userId)
      .eq('server_id', ownerRole.server_id)
  } else {
    console.log('No server/Owner role found yet — run after creating the first space')
  }

  console.log('✓ Admin seeding complete')
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
