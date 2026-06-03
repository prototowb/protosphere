/**
 * Supabase backend integration tests.
 * Requires local Supabase running (`supabase start`).
 * Run via: npm run test:integration
 *
 * These tests verify Supabase-specific behaviour: trigger-based profile
 * creation, RLS enforcement, community bootstrap trigger, and joined-column
 * mapping in responses.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseBackend } from '@/lib/backend/supabase-backend'
import type { Backend } from '@/lib/backend/types'

const LOCAL_URL = 'http://127.0.0.1:54321'
const LOCAL_ANON_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'

function makeBackend() {
  const client = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const backend = createSupabaseBackend(client)
  async function currentUserId(): Promise<string> {
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user) throw new Error('No authenticated user in session')
    return user.id
  }
  return { backend, client, currentUserId }
}

// Only [a-zA-Z0-9_] allowed in usernames; max 32 chars
let counter = 0
function uid() { return `${Date.now()}${++counter}` }
function testEmail() { return `t${uid()}@test.local` }
function testUsername() { return `tu${uid()}`.slice(0, 32) }

// ── Auth ────────────────────────────────────────────────────────────────────

describe('Supabase — auth', () => {
  let b: Backend
  let ctx: ReturnType<typeof makeBackend>

  beforeEach(() => { ctx = makeBackend(); b = ctx.backend })
  afterEach(async () => { await b.auth.logout().catch(() => {}) })

  it('register returns needsConfirmation: false (email confirmation disabled locally)', async () => {
    const result = await b.auth.register(testEmail(), 'password123', testUsername())
    expect(result.needsConfirmation).toBe(false)
  })

  it('login with correct credentials succeeds', async () => {
    const email = testEmail()
    await b.auth.register(email, 'password123', testUsername())
    await b.auth.logout()
    await expect(b.auth.login(email, 'password123')).resolves.toBeUndefined()
  })

  it('login with wrong password throws', async () => {
    const email = testEmail()
    await b.auth.register(email, 'password123', testUsername())
    await b.auth.logout()
    await expect(b.auth.login(email, 'wrongpass')).rejects.toThrow()
  })

  it('logout resolves without error', async () => {
    await b.auth.register(testEmail(), 'password123', testUsername())
    await expect(b.auth.logout()).resolves.toBeUndefined()
  })
})

// ── Profile trigger ──────────────────────────────────────────────────────────

describe('Supabase — profile trigger (handle_new_user)', () => {
  let b: Backend
  let ctx: ReturnType<typeof makeBackend>
  let userId: string

  beforeEach(async () => {
    ctx = makeBackend()
    b = ctx.backend
    await b.auth.register(testEmail(), 'password123', testUsername())
    userId = await ctx.currentUserId()
  })

  afterEach(async () => { await b.auth.logout().catch(() => {}) })

  it('profile is created automatically by handle_new_user trigger', async () => {
    const profile = await b.profiles.get(userId)
    expect(profile.id).toBe(userId)
    expect(profile.username).toBeTruthy()
  })

  it('profile.username is derived from registration metadata', async () => {
    const profile = await b.profiles.get(userId)
    expect(profile.username).toMatch(/^tu/)
  })

  it('profile.update persists changes', async () => {
    const updated = await b.profiles.update(userId, { bio: 'Hello from integration test' })
    expect(updated.bio).toBe('Hello from integration test')
    const fetched = await b.profiles.get(userId)
    expect(fetched.bio).toBe('Hello from integration test')
  })
})

// ── Community bootstrap trigger ──────────────────────────────────────────────

describe('Supabase — community bootstrap trigger', () => {
  it('community.get returns a settings row', async () => {
    const { backend: b, currentUserId } = makeBackend()
    await b.auth.register(testEmail(), 'password123', testUsername())
    await currentUserId() // ensure session is active
    const community = await b.community.get()
    expect(community).toHaveProperty('id')
    expect(community).toHaveProperty('registration_mode')
    await b.auth.logout()
  })
})

// ── Server CRUD + auto-seeding ───────────────────────────────────────────────

describe('Supabase — servers', () => {
  let b: Backend
  let ctx: ReturnType<typeof makeBackend>
  let userId: string

  beforeEach(async () => {
    ctx = makeBackend()
    b = ctx.backend
    await b.auth.register(testEmail(), 'password123', testUsername())
    userId = await ctx.currentUserId()
  })

  afterEach(async () => { await b.auth.logout().catch(() => {}) })

  it('create returns a server with an invite code', async () => {
    const server = await b.servers.create({ name: 'Integration Space' }, userId)
    expect(server.name).toBe('Integration Space')
    expect(server.invite_code).toBeTruthy()
    expect(server.owner_id).toBe(userId)
  })

  it('create auto-creates a #general channel', async () => {
    const server = await b.servers.create({ name: 'Auto Channel Test' }, userId)
    const channels = await b.channels.list(server.id)
    expect(channels.some((c) => c.name === 'general')).toBe(true)
  })

  it('create auto-joins the owner as a member', async () => {
    const server = await b.servers.create({ name: 'Owner Join Test' }, userId)
    const members = await b.members.list(server.id)
    expect(members.some((m) => m.user_id === userId)).toBe(true)
  })

  it('list returns servers the user belongs to', async () => {
    await b.servers.create({ name: 'My Server' }, userId)
    const servers = await b.servers.list(userId)
    expect(servers.length).toBeGreaterThan(0)
  })
})

// ── Messages with profile join ───────────────────────────────────────────────

describe('Supabase — messages (profile join)', () => {
  let b: Backend
  let ctx: ReturnType<typeof makeBackend>
  let userId: string
  let channelId: string

  beforeEach(async () => {
    ctx = makeBackend()
    b = ctx.backend
    await b.auth.register(testEmail(), 'password123', testUsername())
    userId = await ctx.currentUserId()
    const server = await b.servers.create({ name: 'Msg Test Space' }, userId)
    const channels = await b.channels.list(server.id)
    channelId = channels[0].id
  })

  afterEach(async () => { await b.auth.logout().catch(() => {}) })

  it('send returns the message with an attached profile', async () => {
    const msg = await b.messages.send(channelId, userId, 'Hello Supabase!')
    expect(msg.content).toBe('Hello Supabase!')
    expect(msg.author_id).toBe(userId)
    expect(msg).toHaveProperty('profile')
    expect(msg.profile.id).toBe(userId)
  })

  it('list returns messages with attached profiles', async () => {
    await b.messages.send(channelId, userId, 'first')
    await b.messages.send(channelId, userId, 'second')
    const { messages } = await b.messages.list(channelId)
    expect(messages.length).toBeGreaterThanOrEqual(2)
    expect(messages.every((m) => m.profile)).toBe(true)
  })

  it('edit updates message content', async () => {
    const msg = await b.messages.send(channelId, userId, 'original')
    await b.messages.edit(msg.id, 'edited')
    const { messages } = await b.messages.list(channelId)
    expect(messages.find((m) => m.id === msg.id)?.content).toBe('edited')
  })

  it('delete removes the message', async () => {
    const msg = await b.messages.send(channelId, userId, 'to delete')
    await b.messages.delete(msg.id)
    const { messages } = await b.messages.list(channelId)
    expect(messages.find((m) => m.id === msg.id)).toBeUndefined()
  })
})

// ── RLS enforcement ──────────────────────────────────────────────────────────

describe('Supabase — RLS (unauthenticated access blocked)', () => {
  it('servers.list returns empty array for unauthenticated client', async () => {
    const { backend: b } = makeBackend()
    const servers = await b.servers.list('00000000-0000-0000-0000-000000000000')
    expect(servers).toEqual([])
  })

  it('messages.send throws when unauthenticated', async () => {
    // Create a server with auth, then sign out and attempt to send
    const { backend: b, currentUserId } = makeBackend()
    await b.auth.register(testEmail(), 'password123', testUsername())
    const userId = await currentUserId()
    const server = await b.servers.create({ name: 'RLS Test' }, userId)
    const channels = await b.channels.list(server.id)
    await b.auth.logout()
    await expect(
      b.messages.send(channels[0].id, userId, 'rls bypass attempt')
    ).rejects.toThrow()
  })
})
