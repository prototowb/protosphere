/**
 * Sign-out must clear the locally stored session even when the sign-out
 * request fails (offline, server error). These tests drive a real supabase-js
 * client with a stubbed fetch, so they also catch a supabase-js upgrade that
 * changes how sign-out treats storage.
 *
 * In production the storage is the hybrid store from `lib/supabase.ts`, whose
 * removeItem clears both localStorage and the shared session cookie, so
 * asserting on removeItem here covers both.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseBackend } from '@/lib/backend/supabase-backend'

const STORAGE_KEY = 'sb-test-auth-token'

// supabase-js uses addEventListener on its BroadcastChannel; the global test
// mock (src/test/setup.ts) only implements onmessage. Hoisted because importing
// the backend module also constructs the app's default client.
vi.hoisted(() => {
  class TestBroadcastChannel {
    constructor(public name: string) {}
    postMessage() {}
    addEventListener() {}
    removeEventListener() {}
    close() {}
  }
  globalThis.BroadcastChannel = TestBroadcastChannel as unknown as typeof BroadcastChannel
})

function makeStorage() {
  const map = new Map<string, string>()
  return {
    map,
    getItem: vi.fn((key: string) => map.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { map.set(key, value) }),
    removeItem: vi.fn((key: string) => { map.delete(key) }),
  }
}

function storedSession() {
  const now = Math.floor(Date.now() / 1000)
  return JSON.stringify({
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    user: { id: 'u1', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
  })
}

function makeClient(fetchImpl: typeof fetch) {
  const storage = makeStorage()
  storage.map.set(STORAGE_KEY, storedSession())
  const client: SupabaseClient = createClient('http://127.0.0.1:54321', 'test-anon-key', {
    auth: {
      storage,
      storageKey: STORAGE_KEY,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: fetchImpl },
  })
  return { client, storage, backend: createSupabaseBackend(client) }
}

const offline = (() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch
const serverError = (() => Promise.resolve(new Response('{"msg":"boom"}', {
  status: 500,
  headers: { 'Content-Type': 'application/json' },
}))) as unknown as typeof fetch
const ok = (() => Promise.resolve(new Response(null, { status: 204 }))) as unknown as typeof fetch

describe.each([
  ['logout', (b: ReturnType<typeof createSupabaseBackend>) => b.auth.logout()],
  ['logoutGlobal', (b: ReturnType<typeof createSupabaseBackend>) => b.auth.logoutGlobal()],
] as const)('supabase backend %s', (_name, signOut) => {
  beforeEach(() => vi.clearAllMocks())

  it('clears the stored session when the request cannot be sent', async () => {
    const { backend, storage, client } = makeClient(offline)
    await expect(signOut(backend)).rejects.toThrow()
    expect(storage.map.has(STORAGE_KEY)).toBe(false)
    expect(storage.removeItem).toHaveBeenCalledWith(STORAGE_KEY)
    const { data } = await client.auth.getSession()
    expect(data.session).toBeNull()
  })

  it('clears the stored session when the server returns an error', async () => {
    const { backend, storage } = makeClient(serverError)
    await expect(signOut(backend)).rejects.toThrow()
    expect(storage.map.has(STORAGE_KEY)).toBe(false)
  })

  it('emits SIGNED_OUT when clearing locally after a failed request', async () => {
    const { backend, client } = makeClient(offline)
    const events: string[] = []
    const { data: sub } = client.auth.onAuthStateChange((event) => { events.push(event) })
    await expect(signOut(backend)).rejects.toThrow()
    sub.subscription.unsubscribe()
    expect(events).toContain('SIGNED_OUT')
  })

  it('clears the stored session on a successful sign-out', async () => {
    const { backend, storage } = makeClient(ok)
    await expect(signOut(backend)).resolves.toBeUndefined()
    expect(storage.map.has(STORAGE_KEY)).toBe(false)
  })
})

describe('supabase backend sign-out scope', () => {
  function recordingFetch() {
    const urls: string[] = []
    const impl = ((input: RequestInfo | URL) => {
      urls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      return Promise.resolve(new Response(null, { status: 204 }))
    }) as unknown as typeof fetch
    return { urls, impl }
  }

  it('logout ends only the session on this device', async () => {
    const { urls, impl } = recordingFetch()
    const { backend } = makeClient(impl)
    await backend.auth.logout()
    const logoutCall = urls.find((u) => u.includes('/logout'))
    expect(logoutCall).toContain('scope=local')
  })

  it('logoutGlobal ends every session', async () => {
    const { urls, impl } = recordingFetch()
    const { backend } = makeClient(impl)
    await backend.auth.logoutGlobal()
    const logoutCall = urls.find((u) => u.includes('/logout'))
    expect(logoutCall).toContain('scope=global')
  })
})
