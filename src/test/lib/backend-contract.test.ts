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
