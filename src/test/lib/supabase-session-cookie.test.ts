/**
 * The hybrid session storage in `lib/supabase.ts` keeps the full session in
 * localStorage and writes a minimal, short-lived shared cookie on
 * `.protocode.xyz` for sibling subdomains: only the access token and its
 * expiry, with a max-age that ends when the token does. localStorage is the
 * only store chat reads its own session from.
 *
 * `document.cookie` is replaced by a small cookie jar that treats name,
 * domain, path and max-age the way a browser does, and records every raw
 * write so attributes can be asserted. Some tests drive a real supabase-js
 * client with a stubbed fetch, so a supabase-js upgrade that changes when it
 * writes or removes the session is caught here too.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { makeHybridStorage } from '@/lib/supabase'
import { createSupabaseBackend } from '@/lib/backend/supabase-backend'

// supabase-js uses addEventListener on its BroadcastChannel; the global test
// mock (src/test/setup.ts) only implements onmessage. Hoisted because importing
// the backend module also constructs the app's default client.
vi.hoisted(() => {
  class TestBroadcastChannel {
    name: string
    constructor(name: string) {
      this.name = name
    }
    postMessage() {}
    addEventListener() {}
    removeEventListener() {}
    close() {}
  }
  globalThis.BroadcastChannel = TestBroadcastChannel as unknown as typeof BroadcastChannel
})

const SUPABASE_URL = 'https://porlhhdajfaamvggcrbi.supabase.co'
const KEY = 'sb-porlhhdajfaamvggcrbi-auth-token'
const DOMAIN = '.protocode.xyz'
const HOST = 'chat.protocode.xyz'
const NOW = Date.UTC(2026, 10, 23, 12, 0, 0)
const CHUNK_SIZE = 3180

const nowSec = () => Math.floor(Date.now() / 1000)

// ── Cookie jar ──────────────────────────────────────────────────────────────

interface JarCookie {
  name: string
  value: string
  domain: string
  hostOnly: boolean
  path: string
  expiresAtMs: number | null
}

function installCookieJar(host: string) {
  const cookies = new Map<string, JarCookie>()
  const writes: string[] = []

  const live = (): JarCookie[] => {
    for (const [id, c] of cookies) {
      if (c.expiresAtMs !== null && c.expiresAtMs <= Date.now()) cookies.delete(id)
    }
    return [...cookies.values()]
  }

  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => live().map((c) => `${c.name}=${c.value}`).join('; '),
    set: (raw: string) => {
      writes.push(raw)
      const [pair = '', ...attrs] = raw.split(';').map((s) => s.trim())
      const eq = pair.indexOf('=')
      if (eq <= 0) return
      const cookie: JarCookie = {
        name: pair.slice(0, eq),
        value: pair.slice(eq + 1),
        domain: host,
        hostOnly: true,
        path: '/',
        expiresAtMs: null,
      }
      let maxAge: number | null = null
      for (const attr of attrs) {
        const sep = attr.indexOf('=')
        const name = (sep < 0 ? attr : attr.slice(0, sep)).toLowerCase()
        const value = sep < 0 ? '' : attr.slice(sep + 1)
        if (name === 'domain') {
          const d = value.replace(/^\./, '').toLowerCase()
          // A browser ignores a cookie whose domain doesn't cover the host.
          if (host !== d && !host.endsWith(`.${d}`)) return
          cookie.domain = d
          cookie.hostOnly = false
        } else if (name === 'path') {
          cookie.path = value
        } else if (name === 'max-age') {
          maxAge = Number(value)
        }
      }
      const id = `${cookie.name}|${cookie.hostOnly ? 'host' : 'domain'}:${cookie.domain}|${cookie.path}`
      if (maxAge !== null) {
        if (maxAge <= 0) {
          cookies.delete(id)
          return
        }
        cookie.expiresAtMs = Date.now() + maxAge * 1000
      }
      cookies.set(id, cookie)
    },
  })

  return {
    writes,
    /** Names of the live cookies on the shared parent domain. */
    sharedNames: () =>
      live()
        .filter((c) => !c.hostOnly && c.domain === 'protocode.xyz' && c.path === '/')
        .map((c) => c.name)
        .sort(),
    /** Raw (still encoded) value of a live shared cookie. */
    rawValue: (name: string) =>
      live().find((c) => c.name === name && !c.hostOnly && c.domain === 'protocode.xyz')?.value,
    /** The last raw write for a cookie name, with its attributes. */
    lastWrite: (name: string) => [...writes].reverse().find((w) => w.startsWith(`${name}=`)),
    /** Plant a cookie the way an earlier build wrote it (one-year max-age). */
    plant: (name: string, value: string) => {
      document.cookie = `${name}=${encodeURIComponent(value)}; path=/; domain=${DOMAIN}; max-age=31536000; SameSite=Lax`
    },
    restore: () => {
      delete (document as { cookie?: string }).cookie
    },
  }
}

type Jar = ReturnType<typeof installCookieJar>

/** Decoded JSON held by the shared cookie, single or chunked. */
function sharedJson(jar: Jar, key = KEY): unknown {
  const single = jar.rawValue(key)
  if (single !== undefined) return JSON.parse(decodeURIComponent(single))
  let acc = ''
  for (let i = 0; jar.rawValue(`${key}.${i}`) !== undefined; i++) {
    acc += decodeURIComponent(jar.rawValue(`${key}.${i}`)!)
  }
  return acc ? JSON.parse(acc) : undefined
}

function attrsOf(write: string | undefined): string[] {
  return (write ?? '').split(';').slice(1).map((s) => s.trim()).filter(Boolean)
}

// ── Sessions ────────────────────────────────────────────────────────────────

function b64url(obj: object): string {
  return btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function jwt(sub: string, exp: number, extra: Record<string, unknown> = {}): string {
  return `${b64url({ alg: 'ES256', typ: 'JWT' })}.${b64url({ iss: `${SUPABASE_URL}/auth/v1`, sub, exp, ...extra })}.c2lnbmF0dXJl`
}

function fullSession(opts: { expiresAt?: number; accessToken?: string; refreshToken?: string } = {}) {
  const expires_at = opts.expiresAt ?? nowSec() + 3600
  return {
    access_token: opts.accessToken ?? jwt('u1', expires_at),
    refresh_token: opts.refreshToken ?? 'refresh-token-1',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at,
    user: {
      id: 'u1',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'member@example.test',
      app_metadata: { provider: 'email' },
      user_metadata: { username: 'member' },
      identities: [],
      created_at: '2026-01-01T00:00:00Z',
    },
  }
}

/** The cookie payload an earlier build wrote: the session minus heavy user fields. */
function earlierCookiePayload(session: ReturnType<typeof fullSession>): string {
  const user: Record<string, unknown> = { ...session.user }
  delete user.identities
  delete user.user_metadata
  delete user.app_metadata
  return JSON.stringify({ ...session, user })
}

function makeClient(storage: ReturnType<typeof makeHybridStorage>, fetchImpl: typeof fetch): SupabaseClient {
  return createClient(SUPABASE_URL, 'test-anon-key', {
    auth: { storage, storageKey: KEY, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchImpl },
  })
}

const offline = (() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch

// ── Tests ───────────────────────────────────────────────────────────────────

describe('hybrid session storage: shared cookie', () => {
  let jar: Jar
  const originalLocation = window.location

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    window.localStorage.clear()
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, protocol: 'https:', hostname: HOST, reload: vi.fn() },
      writable: true,
      configurable: true,
    })
    jar = installCookieJar(HOST)
  })

  afterEach(() => {
    jar.restore()
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true })
    window.localStorage.clear()
    vi.useRealTimers()
  })

  describe('setItem', () => {
    it('keeps the full session in localStorage and writes only the access token and expiry to the shared cookie', () => {
      const storage = makeHybridStorage(DOMAIN, KEY)
      const session = fullSession()
      storage.setItem(KEY, JSON.stringify(session))

      expect(window.localStorage.getItem(KEY)).toBe(JSON.stringify(session))
      expect(jar.sharedNames()).toEqual([KEY])
      expect(jar.rawValue(KEY)).toBe(
        encodeURIComponent(JSON.stringify({ access_token: session.access_token, expires_at: session.expires_at })),
      )
      const payload = sharedJson(jar) as Record<string, unknown>
      expect(Object.keys(payload)).toEqual(['access_token', 'expires_at'])
    })

    it('sets max-age to the time left until expires_at, with the shared-domain attributes', () => {
      const storage = makeHybridStorage(DOMAIN, KEY)
      storage.setItem(KEY, JSON.stringify(fullSession({ expiresAt: nowSec() + 1234 })))

      expect(attrsOf(jar.lastWrite(KEY))).toEqual([
        'path=/',
        `domain=${DOMAIN}`,
        'max-age=1234',
        'SameSite=Lax',
        'Secure',
      ])
    })

    it('omits Secure off https', () => {
      Object.defineProperty(window, 'location', {
        value: { ...window.location, protocol: 'http:' },
        writable: true,
        configurable: true,
      })
      const storage = makeHybridStorage(DOMAIN, KEY)
      storage.setItem(KEY, JSON.stringify(fullSession()))
      expect(attrsOf(jar.lastWrite(KEY))).not.toContain('Secure')
    })

    it('lets the shared cookie expire together with the access token', () => {
      const storage = makeHybridStorage(DOMAIN, KEY)
      storage.setItem(KEY, JSON.stringify(fullSession({ expiresAt: nowSec() + 600 })))

      vi.setSystemTime(NOW + 599_000)
      expect(jar.sharedNames()).toEqual([KEY])
      vi.setSystemTime(NOW + 601_000)
      expect(jar.sharedNames()).toEqual([])
      // localStorage is untouched: supabase-js refreshes from it.
      expect(window.localStorage.getItem(KEY)).not.toBeNull()
    })

    it('leaves no shared cookie for a session that has already expired', () => {
      const storage = makeHybridStorage(DOMAIN, KEY)
      storage.setItem(KEY, JSON.stringify(fullSession({ expiresAt: nowSec() - 10 })))

      expect(jar.sharedNames()).toEqual([])
      for (const write of jar.writes) {
        const maxAge = /max-age=(-?\d+)/.exec(write)?.[1]
        if (maxAge !== undefined) expect(Number(maxAge)).toBeGreaterThanOrEqual(0)
      }
      expect(window.localStorage.getItem(KEY)).not.toBeNull()
    })

    it('splits a value over the per-cookie limit into chunks that reassemble to the minimal payload', () => {
      const storage = makeHybridStorage(DOMAIN, KEY)
      const expiresAt = nowSec() + 3600
      const session = fullSession({ expiresAt, accessToken: jwt('u1', expiresAt, { pad: 'x'.repeat(CHUNK_SIZE) }) })
      storage.setItem(KEY, JSON.stringify(session))

      expect(jar.sharedNames()).toEqual([`${KEY}.0`, `${KEY}.1`])
      expect(sharedJson(jar)).toEqual({ access_token: session.access_token, expires_at: expiresAt })
      expect(attrsOf(jar.lastWrite(`${KEY}.1`))).toContain('max-age=3600')
    })

    it('does not write a shared cookie for values that are not a session', () => {
      const storage = makeHybridStorage(DOMAIN, KEY)
      storage.setItem(`${KEY}-code-verifier`, JSON.stringify('verifier-value'))

      expect(window.localStorage.getItem(`${KEY}-code-verifier`)).toBe(JSON.stringify('verifier-value'))
      expect(jar.sharedNames()).toEqual([])
    })
  })

  describe('token refresh', () => {
    it('rewrites the shared cookie with the refreshed token and its expiry', async () => {
      const first = fullSession({ expiresAt: nowSec() + 600 })
      window.localStorage.setItem(KEY, JSON.stringify(first))
      const storage = makeHybridStorage(DOMAIN, KEY)

      const refreshedExpiry = nowSec() + 3600
      const refreshed = fullSession({
        expiresAt: refreshedExpiry,
        accessToken: jwt('u1', refreshedExpiry, { session_id: 's2' }),
        refreshToken: 'refresh-token-2',
      })
      const fetchImpl = vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (url.includes('/token') && url.includes('grant_type=refresh_token')) {
          return Promise.resolve(new Response(JSON.stringify(refreshed), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }))
        }
        return Promise.resolve(new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } }))
      }) as unknown as typeof fetch

      const client = makeClient(storage, fetchImpl)
      const { error } = await client.auth.refreshSession()
      expect(error).toBeNull()

      expect(jar.sharedNames()).toEqual([KEY])
      expect(sharedJson(jar)).toEqual({ access_token: refreshed.access_token, expires_at: refreshedExpiry })
      expect(attrsOf(jar.lastWrite(KEY))).toContain('max-age=3600')
      expect(JSON.parse(window.localStorage.getItem(KEY)!).refresh_token).toBe('refresh-token-2')
    })
  })

  describe('getItem', () => {
    it('ignores a shared cookie in the earlier format when localStorage is empty', () => {
      const storage = makeHybridStorage(DOMAIN, KEY)
      jar.plant(KEY, earlierCookiePayload(fullSession()))

      expect(storage.getItem(KEY)).toBeNull()
    })

    it('ignores a minimal shared cookie when localStorage is empty', () => {
      const storage = makeHybridStorage(DOMAIN, KEY)
      const session = fullSession()
      jar.plant(KEY, JSON.stringify({ access_token: session.access_token, expires_at: session.expires_at }))

      expect(storage.getItem(KEY)).toBeNull()
    })

    it('returns the localStorage session, not the cookie', () => {
      const storage = makeHybridStorage(DOMAIN, KEY)
      const local = fullSession({ refreshToken: 'local-refresh' })
      window.localStorage.setItem(KEY, JSON.stringify(local))
      jar.plant(KEY, earlierCookiePayload(fullSession({ refreshToken: 'cookie-refresh' })))

      expect(storage.getItem(KEY)).toBe(JSON.stringify(local))
    })

    it('does not give supabase-js a session from the cookie', async () => {
      const storage = makeHybridStorage(DOMAIN, KEY)
      jar.plant(KEY, earlierCookiePayload(fullSession()))
      const client = makeClient(storage, offline)

      const { data } = await client.auth.getSession()
      expect(data.session).toBeNull()
    })
  })

  describe('cookies from earlier builds', () => {
    it('rewrites a full-format cookie in the minimal format when the storage is created', () => {
      const session = fullSession({ expiresAt: nowSec() + 1800 })
      window.localStorage.setItem(KEY, JSON.stringify(session))
      jar.plant(KEY, earlierCookiePayload(session))

      makeHybridStorage(DOMAIN, KEY)

      expect(jar.sharedNames()).toEqual([KEY])
      expect(sharedJson(jar)).toEqual({ access_token: session.access_token, expires_at: session.expires_at })
      expect(attrsOf(jar.lastWrite(KEY))).toContain('max-age=1800')
    })

    it('replaces a chunked full-format cookie with a single minimal one', () => {
      const session = fullSession()
      window.localStorage.setItem(KEY, JSON.stringify(session))
      const old = earlierCookiePayload(session)
      const mid = Math.ceil(old.length / 2)
      jar.plant(`${KEY}.0`, old.slice(0, mid))
      jar.plant(`${KEY}.1`, old.slice(mid))

      makeHybridStorage(DOMAIN, KEY)

      expect(jar.sharedNames()).toEqual([KEY])
      expect(sharedJson(jar)).toEqual({ access_token: session.access_token, expires_at: session.expires_at })
    })

    it('removes an earlier cookie when localStorage holds no session', () => {
      jar.plant(KEY, earlierCookiePayload(fullSession()))
      jar.plant(`${KEY}.0`, 'stale-chunk')

      makeHybridStorage(DOMAIN, KEY)

      expect(jar.sharedNames()).toEqual([])
    })

    it('leaves only the minimal cookie after a load where supabase-js restores a valid session', async () => {
      const session = fullSession({ expiresAt: nowSec() + 3000 })
      window.localStorage.setItem(KEY, JSON.stringify(session))
      jar.plant(KEY, earlierCookiePayload(session))

      const client = makeClient(makeHybridStorage(DOMAIN, KEY), offline)
      const { data } = await client.auth.getSession()

      expect(data.session?.access_token).toBe(session.access_token)
      expect(jar.sharedNames()).toEqual([KEY])
      expect(sharedJson(jar)).toEqual({ access_token: session.access_token, expires_at: session.expires_at })
    })
  })

  describe('removeItem and sign-out', () => {
    it('clears localStorage and every form of the shared cookie', () => {
      const storage = makeHybridStorage(DOMAIN, KEY)
      window.localStorage.setItem(KEY, JSON.stringify(fullSession()))
      jar.plant(KEY, 'single')
      jar.plant(`${KEY}.0`, 'chunk-0')
      jar.plant(`${KEY}.1`, 'chunk-1')
      jar.plant(`${KEY}.2`, 'chunk-2')

      storage.removeItem(KEY)

      expect(window.localStorage.getItem(KEY)).toBeNull()
      expect(jar.sharedNames()).toEqual([])
    })

    it('clears a chunked minimal cookie it wrote itself', () => {
      const storage = makeHybridStorage(DOMAIN, KEY)
      const expiresAt = nowSec() + 3600
      storage.setItem(KEY, JSON.stringify(fullSession({
        expiresAt,
        accessToken: jwt('u1', expiresAt, { pad: 'x'.repeat(CHUNK_SIZE) }),
      })))
      expect(jar.sharedNames()).toEqual([`${KEY}.0`, `${KEY}.1`])

      storage.removeItem(KEY)

      expect(jar.sharedNames()).toEqual([])
    })

    it.each([
      ['logout', (b: ReturnType<typeof createSupabaseBackend>) => b.auth.logout()],
      ['logoutGlobal', (b: ReturnType<typeof createSupabaseBackend>) => b.auth.logoutGlobal()],
    ] as const)('%s clears every form of the shared cookie even when the request cannot be sent', async (_name, signOut) => {
      window.localStorage.setItem(KEY, JSON.stringify(fullSession()))
      const storage = makeHybridStorage(DOMAIN, KEY)
      const backend = createSupabaseBackend(makeClient(storage, offline))
      jar.plant(KEY, 'single')
      jar.plant(`${KEY}.0`, 'chunk-0')
      jar.plant(`${KEY}.1`, 'chunk-1')

      await expect(signOut(backend)).rejects.toThrow()

      expect(window.localStorage.getItem(KEY)).toBeNull()
      expect(jar.sharedNames()).toEqual([])
    })
  })
})
