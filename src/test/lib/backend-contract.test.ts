/**
 * Backend contract tests — run against the local backend.
 *
 * Extension path for Supabase: create a `makeSupabaseBackend()` factory that
 * accepts a test DB connection (e.g. via a local Supabase instance at
 * VITE_SUPABASE_URL=http://127.0.0.1:54321), then call
 * `describeBackendContract(makeSupabaseBackend(), 'supabase')` in a second
 * describe block. Mark with `describe.skip` until CI has a Supabase fixture.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createLocalBackend } from '@/lib/backend/local'
import type { Backend } from '@/lib/backend/types'

// happy-dom ships localStorage; clear it before each test for isolation
beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

function makeBackend(): Backend {
  return createLocalBackend()
}

// ── Shared contract suite ──────────────────────────────────────────────────────

function describeBackendContract(label: string, getBackend: () => Backend) {
  describe(`Backend contract — ${label}`, () => {
    // ── auth ────────────────────────────────────────────────────────────────

    describe('auth.register', () => {
      it('creates a user and returns needsConfirmation: false', async () => {
        const b = getBackend()
        const result = await b.auth.register('a@b.com', 'pass123', 'alice')
        expect(result).toEqual({ needsConfirmation: false })
      })

      it('throws on duplicate email', async () => {
        const b = getBackend()
        await b.auth.register('a@b.com', 'pass', 'alice')
        await expect(b.auth.register('a@b.com', 'pass2', 'bob')).rejects.toThrow()
      })

      it('throws on duplicate username', async () => {
        const b = getBackend()
        await b.auth.register('a@b.com', 'pass', 'alice')
        await expect(b.auth.register('b@b.com', 'pass', 'alice')).rejects.toThrow()
      })
    })

    describe('auth.login', () => {
      it('succeeds with correct credentials', async () => {
        const b = getBackend()
        await b.auth.register('a@b.com', 'pass123', 'alice')
        await b.auth.logout()
        await expect(b.auth.login('a@b.com', 'pass123')).resolves.toBeUndefined()
      })

      it('throws on wrong password', async () => {
        const b = getBackend()
        await b.auth.register('a@b.com', 'pass123', 'alice')
        await expect(b.auth.login('a@b.com', 'wrongpass')).rejects.toThrow()
      })

      it('throws on unknown email', async () => {
        const b = getBackend()
        await expect(b.auth.login('unknown@b.com', 'pass')).rejects.toThrow()
      })
    })

    describe('auth.logout', () => {
      it('does not throw when called while logged out', async () => {
        const b = getBackend()
        await expect(b.auth.logout()).resolves.toBeUndefined()
      })
    })

    describe('auth.init', () => {
      it('fires callback with null when no session exists', () => {
        const b = getBackend()
        const onSession = vi.fn()
        b.auth.init(onSession)
        expect(onSession).toHaveBeenCalledWith(null)
      })

      it('fires callback with session after register', async () => {
        const b = getBackend()
        const onSession = vi.fn()
        b.auth.init(onSession)
        onSession.mockClear()
        await b.auth.register('a@b.com', 'pass', 'alice')
        expect(onSession).toHaveBeenCalledWith(
          expect.objectContaining({ user: expect.objectContaining({ email: 'a@b.com' }) }),
        )
      })
    })

    // ── community ────────────────────────────────────────────────────────────

    describe('community.get', () => {
      it('returns a community settings object', async () => {
        const b = getBackend()
        const community = await b.community.get()
        expect(community).toHaveProperty('id')
        expect(community).toHaveProperty('name')
        expect(community).toHaveProperty('registration_mode')
      })
    })

    describe('community.update', () => {
      it('updates the community name', async () => {
        const b = getBackend()
        const updated = await b.community.update({ name: 'New Name' })
        expect(updated.name).toBe('New Name')
      })

      it('persists changes across calls', async () => {
        const b = getBackend()
        await b.community.update({ name: 'Persistent Name' })
        const fetched = await b.community.get()
        expect(fetched.name).toBe('Persistent Name')
      })

      it('first registered user becomes community owner', async () => {
        const b = getBackend()
        await b.auth.register('owner@b.com', 'pass', 'owner')
        const community = await b.community.get()
        expect(community.owner_id).toBeTruthy()
      })
    })

    // ── community_invites ────────────────────────────────────────────────────

    describe('community_invites', () => {
      let b: Backend
      let creatorId: string

      beforeEach(async () => {
        b = getBackend()
        await b.auth.register('admin@b.com', 'pass', 'admin')
        const community = await b.community.get()
        creatorId = community.owner_id ?? 'fallback-id'
      })

      it('create returns an invite with a token', async () => {
        const invite = await b.community_invites.create({ created_by: creatorId, usage: 'single_use' })
        expect(invite).toHaveProperty('token')
        expect(invite.token.length).toBeGreaterThan(0)
      })

      it('validate returns the invite for a valid token', async () => {
        const invite = await b.community_invites.create({ created_by: creatorId, usage: 'single_use' })
        const found = await b.community_invites.validate(invite.token)
        expect(found?.token).toBe(invite.token)
      })

      it('validate returns null for an unknown token', async () => {
        const found = await b.community_invites.validate('nonexistent-token')
        expect(found).toBeNull()
      })

      it('list returns created invites for the creator', async () => {
        await b.community_invites.create({ created_by: creatorId, usage: 'single_use' })
        const list = await b.community_invites.list(creatorId)
        expect(list.length).toBeGreaterThan(0)
      })

      it('revoke makes the invite unavailable', async () => {
        const invite = await b.community_invites.create({ created_by: creatorId, usage: 'single_use' })
        await b.community_invites.revoke(invite.id)
        const list = await b.community_invites.list(creatorId)
        expect(list.find((i) => i.id === invite.id)).toBeUndefined()
      })

      it('use marks a single_use invite as consumed (validate returns null after use)', async () => {
        const invite = await b.community_invites.create({ created_by: creatorId, usage: 'single_use' })
        await b.auth.register('member@b.com', 'pass', 'member')
        const memberCommunity = await b.community.get()
        const memberId = memberCommunity.owner_id ?? 'member-id'
        await b.community_invites.use(invite.token, memberId)
        const revalidated = await b.community_invites.validate(invite.token)
        expect(revalidated).toBeNull()
      })
    })

    // ── profiles ─────────────────────────────────────────────────────────────

    describe('profiles', () => {
      let b: Backend
      let userId: string

      beforeEach(async () => {
        b = getBackend()
        await b.auth.register('alice@b.com', 'pass', 'alice')
        const community = await b.community.get()
        userId = community.owner_id!
      })

      it('get returns a profile for a registered user', async () => {
        const profile = await b.profiles.get(userId)
        expect(profile).toHaveProperty('id', userId)
        expect(profile.username).toBe('alice')
      })

      it('throws when getting a non-existent profile', async () => {
        await expect(b.profiles.get('nonexistent-id')).rejects.toThrow()
      })

      it('update persists changes', async () => {
        const updated = await b.profiles.update(userId, { bio: 'Hello world' })
        expect(updated.bio).toBe('Hello world')
        const fetched = await b.profiles.get(userId)
        expect(fetched.bio).toBe('Hello world')
      })

      it('search finds profiles by username substring', async () => {
        const results = await b.profiles.search('ali', 'other-user')
        expect(results.some((p) => p.username === 'alice')).toBe(true)
      })

      it('search excludes the given userId', async () => {
        const results = await b.profiles.search('alice', userId)
        expect(results.find((p) => p.id === userId)).toBeUndefined()
      })

      it('getByUsername returns the correct profile', async () => {
        const profile = await b.profiles.getByUsername('alice')
        expect(profile.id).toBe(userId)
      })
    })

    // ── servers ───────────────────────────────────────────────────────────────

    describe('servers', () => {
      let b: Backend
      let ownerId: string

      beforeEach(async () => {
        b = getBackend()
        await b.auth.register('owner@b.com', 'pass', 'owner')
        const community = await b.community.get()
        ownerId = community.owner_id!
      })

      it('create returns a server with a name and invite code', async () => {
        const server = await b.servers.create({ name: 'Test Space' }, ownerId)
        expect(server.name).toBe('Test Space')
        expect(server.invite_code).toBeTruthy()
        expect(server.owner_id).toBe(ownerId)
      })

      it('create auto-creates a #general channel', async () => {
        const server = await b.servers.create({ name: 'Test Space' }, ownerId)
        const channels = await b.channels.list(server.id)
        expect(channels.some((c) => c.name === 'general')).toBe(true)
      })

      it('create auto-joins the owner as a member', async () => {
        const server = await b.servers.create({ name: 'Test Space' }, ownerId)
        const members = await b.members.list(server.id)
        expect(members.some((m) => m.user_id === ownerId)).toBe(true)
      })

      it('list returns only servers the user belongs to', async () => {
        await b.servers.create({ name: 'Mine' }, ownerId)
        const servers = await b.servers.list(ownerId)
        expect(servers.length).toBe(1)
        expect(servers[0].name).toBe('Mine')
      })

      it('get returns the server by id', async () => {
        const created = await b.servers.create({ name: 'FindMe' }, ownerId)
        const fetched = await b.servers.get(created.id)
        expect(fetched.name).toBe('FindMe')
      })

      it('update changes the server name', async () => {
        const server = await b.servers.create({ name: 'Old Name' }, ownerId)
        await b.servers.update(server.id, { name: 'New Name' })
        const fetched = await b.servers.get(server.id)
        expect(fetched.name).toBe('New Name')
      })

      it('delete removes the server from list', async () => {
        const server = await b.servers.create({ name: 'Doomed' }, ownerId)
        await b.servers.delete(server.id)
        const servers = await b.servers.list(ownerId)
        expect(servers.find((s) => s.id === server.id)).toBeUndefined()
      })

      it('getByInviteCode returns the server', async () => {
        const server = await b.servers.create({ name: 'Invite Test' }, ownerId)
        const found = await b.servers.getByInviteCode(server.invite_code)
        expect(found.id).toBe(server.id)
      })

      it('regenerateInviteCode returns a new code', async () => {
        const server = await b.servers.create({ name: 'Regen' }, ownerId)
        const oldCode = server.invite_code
        const newCode = await b.servers.regenerateInviteCode(server.id)
        expect(newCode).not.toBe(oldCode)
      })
    })

    // ── channels ──────────────────────────────────────────────────────────────

    describe('channels', () => {
      let b: Backend
      let ownerId: string
      let serverId: string

      beforeEach(async () => {
        b = getBackend()
        await b.auth.register('owner@b.com', 'pass', 'owner')
        const community = await b.community.get()
        ownerId = community.owner_id!
        const server = await b.servers.create({ name: 'Test Space' }, ownerId)
        serverId = server.id
      })

      it('list returns channels for the server (at least #general)', async () => {
        const channels = await b.channels.list(serverId)
        expect(channels.length).toBeGreaterThan(0)
      })

      it('create adds a channel and slugifies the name', async () => {
        const ch = await b.channels.create({ server_id: serverId, name: 'Hello World' })
        expect(ch.name).toBe('hello-world')
        expect(ch.server_id).toBe(serverId)
      })

      it('get returns the channel by id', async () => {
        const ch = await b.channels.create({ server_id: serverId, name: 'test' })
        const fetched = await b.channels.get(ch.id)
        expect(fetched.id).toBe(ch.id)
      })

      it('update changes channel description', async () => {
        const ch = await b.channels.create({ server_id: serverId, name: 'desc-test' })
        await b.channels.update(ch.id, { description: 'Updated desc' })
        const fetched = await b.channels.get(ch.id)
        expect(fetched.description).toBe('Updated desc')
      })

      it('delete removes the channel', async () => {
        const ch = await b.channels.create({ server_id: serverId, name: 'delete-me' })
        await b.channels.delete(ch.id)
        await expect(b.channels.get(ch.id)).rejects.toThrow()
      })
    })

    // ── members ───────────────────────────────────────────────────────────────

    describe('members', () => {
      let b: Backend
      let ownerId: string
      let memberId: string
      let serverId: string

      beforeEach(async () => {
        b = getBackend()
        await b.auth.register('owner@b.com', 'pass', 'owner')
        const community = await b.community.get()
        ownerId = community.owner_id!
        const server = await b.servers.create({ name: 'Test Space' }, ownerId)
        serverId = server.id

        await b.auth.register('member@b.com', 'pass', 'member')
        // register sets the session — grab the second user's id from profile search
        const results = await b.profiles.search('member', ownerId)
        memberId = results[0].id
      })

      it('list returns members with profiles', async () => {
        const members = await b.members.list(serverId)
        expect(members.length).toBeGreaterThan(0)
        expect(members[0]).toHaveProperty('profile')
      })

      it('join adds the user to the server', async () => {
        await b.members.join(serverId, memberId)
        const members = await b.members.list(serverId)
        expect(members.some((m) => m.user_id === memberId)).toBe(true)
      })

      it('join is idempotent (no error on re-join)', async () => {
        await b.members.join(serverId, memberId)
        await expect(b.members.join(serverId, memberId)).resolves.not.toThrow()
      })

      it('leave removes the user from the server', async () => {
        await b.members.join(serverId, memberId)
        await b.members.leave(serverId, memberId)
        const members = await b.members.list(serverId)
        expect(members.find((m) => m.user_id === memberId)).toBeUndefined()
      })
    })

    // ── messages ──────────────────────────────────────────────────────────────

    describe('messages', () => {
      let b: Backend
      let ownerId: string
      let channelId: string

      beforeEach(async () => {
        b = getBackend()
        await b.auth.register('owner@b.com', 'pass', 'owner')
        const community = await b.community.get()
        ownerId = community.owner_id!
        const server = await b.servers.create({ name: 'Test Space' }, ownerId)
        const channels = await b.channels.list(server.id)
        channelId = channels[0].id
      })

      it('list returns empty for a channel with no messages', async () => {
        const { messages, hasMore } = await b.messages.list(channelId)
        expect(messages).toEqual([])
        expect(hasMore).toBe(false)
      })

      it('send returns the message with attached profile', async () => {
        const msg = await b.messages.send(channelId, ownerId, 'Hello!')
        expect(msg.content).toBe('Hello!')
        expect(msg.author_id).toBe(ownerId)
        expect(msg).toHaveProperty('profile')
        expect(msg.profile.id).toBe(ownerId)
      })

      it('list returns messages in chronological order', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
        await b.messages.send(channelId, ownerId, 'first')
        vi.advanceTimersByTime(1000)
        await b.messages.send(channelId, ownerId, 'second')
        vi.useRealTimers()
        const { messages } = await b.messages.list(channelId)
        expect(messages[0].content).toBe('first')
        expect(messages[1].content).toBe('second')
      })

      it('edit updates message content', async () => {
        const msg = await b.messages.send(channelId, ownerId, 'original')
        await b.messages.edit(msg.id, 'updated')
        const { messages } = await b.messages.list(channelId)
        expect(messages.find((m) => m.id === msg.id)?.content).toBe('updated')
      })

      it('delete removes the message', async () => {
        const msg = await b.messages.send(channelId, ownerId, 'delete me')
        await b.messages.delete(msg.id)
        const { messages } = await b.messages.list(channelId)
        expect(messages.find((m) => m.id === msg.id)).toBeUndefined()
      })

      it('pin and unpin toggle pinned state', async () => {
        const msg = await b.messages.send(channelId, ownerId, 'pin me')
        await b.messages.pin(msg.id)
        const pinned = await b.messages.listPinned(channelId)
        expect(pinned.some((m) => m.id === msg.id)).toBe(true)
        await b.messages.unpin(msg.id)
        const unpinned = await b.messages.listPinned(channelId)
        expect(unpinned.find((m) => m.id === msg.id)).toBeUndefined()
      })
    })
  })
}

// ── Run against local backend ────────────────────────────────────────────────

describeBackendContract('local', makeBackend)

// ── Supabase backend (skip until CI has a Supabase fixture) ─────────────────
// import { createClient } from '@supabase/supabase-js'
// import { createSupabaseBackend } from '@/lib/backend/supabase-backend'
//
// function makeSupabaseBackend(): Backend {
//   const client = createClient(
//     process.env.VITE_SUPABASE_URL!,
//     process.env.VITE_SUPABASE_ANON_KEY!,
//   )
//   return createSupabaseBackend(client)
// }
//
// describe.skip('Backend contract — supabase', () => {
//   describeBackendContract('supabase', makeSupabaseBackend)
// })
