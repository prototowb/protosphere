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
import { createPinia, setActivePinia } from 'pinia'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { makeHybridStorage } from '@/lib/supabase'
import { createSupabaseBackend } from '@/lib/backend/supabase-backend'
import { useAuth } from '@/composables/useAuth'
import { useAuthStore } from '@/stores/auth'

// useAuth reads the app backend from '@/lib/backend'; the single sign-out
// tests point it at a backend built on a real client and the cookie jar.
const appBackend = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('@/lib/backend', () => ({
  isLocalMode: false,
  get backend() {
    return appBackend.current
  },
}))
const { mockResetAppToLogin } = vi.hoisted(() => ({ mockResetAppToLogin: vi.fn() }))
vi.mock('@/lib/sessionReset', () => ({ resetAppToLogin: mockResetAppToLogin }))

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

// ── Single sign-out across protocode.xyz apps ───────────────────────────────

const MARKER = 'protocode-signout'
const MARKER_MAX_AGE = 2592000

function sessionWithSid(sid: string, opts: { expiresAt?: number; refreshToken?: string } = {}) {
  const expiresAt = opts.expiresAt ?? nowSec() + 3600
  return fullSession({ ...opts, expiresAt, accessToken: jwt('u1', expiresAt, { session_id: sid }) })
}

function markerValue(sids: unknown[], v: unknown = 1): string {
  return encodeURIComponent(JSON.stringify({ v, sids }))
}

/** Write a marker cookie the way a sibling app does (raw, already encoded). */
function plantMarker(raw: string) {
  document.cookie = `${MARKER}=${raw}; path=/; domain=${DOMAIN}; max-age=${MARKER_MAX_AGE}; SameSite=Lax; Secure`
}

function markerJson(jar: Jar): unknown {
  const raw = jar.rawValue(MARKER)
  return raw === undefined ? undefined : JSON.parse(decodeURIComponent(raw))
}

function markerSids(jar: Jar): unknown {
  return (markerJson(jar) as { sids?: unknown } | undefined)?.sids
}

function urlOf(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const rejectedRefresh = ((input: RequestInfo | URL) => Promise.resolve(
  urlOf(input).includes('grant_type=refresh_token')
    ? jsonResponse({ code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' }, 400)
    : jsonResponse({}, 404),
)) as unknown as typeof fetch

describe('single sign-out across protocode.xyz apps', () => {
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
    mockResetAppToLogin.mockClear()
    appBackend.current = null
  })

  afterEach(() => {
    jar.restore()
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true })
    window.localStorage.clear()
    vi.useRealTimers()
  })

  describe('marking an ended session', () => {
    it('adds the session id to the shared marker when the stored session is removed', () => {
      window.localStorage.setItem(KEY, JSON.stringify(sessionWithSid('s1')))
      const storage = makeHybridStorage(DOMAIN, KEY)

      storage.removeItem(KEY)

      expect(window.localStorage.getItem(KEY)).toBeNull()
      expect(jar.rawValue(MARKER)).toBe(markerValue(['s1']))
      expect(markerJson(jar)).toEqual({ v: 1, sids: ['s1'] })
      expect(attrsOf(jar.lastWrite(MARKER))).toEqual([
        'path=/',
        `domain=${DOMAIN}`,
        `max-age=${MARKER_MAX_AGE}`,
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
      window.localStorage.setItem(KEY, JSON.stringify(sessionWithSid('s1')))
      makeHybridStorage(DOMAIN, KEY).removeItem(KEY)

      expect(attrsOf(jar.lastWrite(MARKER))).not.toContain('Secure')
    })

    it('appends newest last and keeps at most 5 entries', () => {
      plantMarker(markerValue(['a', 'b', 'c', 'd', 'e']))
      window.localStorage.setItem(KEY, JSON.stringify(sessionWithSid('s6')))

      makeHybridStorage(DOMAIN, KEY).removeItem(KEY)

      expect(markerSids(jar)).toEqual(['b', 'c', 'd', 'e', 's6'])
    })

    it('lists a session id once, as the newest entry', () => {
      plantMarker(markerValue(['s1', 's2']))
      window.localStorage.setItem(KEY, JSON.stringify(sessionWithSid('s1')))

      makeHybridStorage(DOMAIN, KEY).removeItem(KEY)

      expect(markerSids(jar)).toEqual(['s2', 's1'])
    })

    it.each([
      ['not JSON', encodeURIComponent('not-json')],
      ['broken percent-encoding', '%E0%A4%A'],
      ['sids not an array', encodeURIComponent(JSON.stringify({ v: 1, sids: 's0' }))],
      ['an unknown version', markerValue(['s0'], 2)],
      ['a JSON array', encodeURIComponent('[1,2]')],
      ['an oversized entry', markerValue(['x'.repeat(500)])],
    ])('replaces a malformed marker (%s) without throwing', (_label, raw) => {
      plantMarker(raw)
      window.localStorage.setItem(KEY, JSON.stringify(sessionWithSid('s1')))
      const storage = makeHybridStorage(DOMAIN, KEY)

      expect(() => storage.removeItem(KEY)).not.toThrow()

      expect(window.localStorage.getItem(KEY)).toBeNull()
      expect(jar.sharedNames()).toEqual([MARKER])
      expect(markerJson(jar)).toEqual({ v: 1, sids: ['s1'] })
    })

    it('keeps the valid entries of a marker with some invalid ones', () => {
      plantMarker(markerValue([1, null, {}, '', 'ok']))
      window.localStorage.setItem(KEY, JSON.stringify(sessionWithSid('s1')))

      makeHybridStorage(DOMAIN, KEY).removeItem(KEY)

      expect(markerSids(jar)).toEqual(['ok', 's1'])
    })

    it.each([
      ['an access token without session_id', JSON.stringify(fullSession())],
      ['an access token that is not a JWT', JSON.stringify(fullSession({ accessToken: 'opaque' }))],
      ['a value that is not JSON', 'not-json'],
    ])('writes no marker for %s', (_label, stored) => {
      window.localStorage.setItem(KEY, stored)
      const storage = makeHybridStorage(DOMAIN, KEY)

      expect(() => storage.removeItem(KEY)).not.toThrow()

      expect(window.localStorage.getItem(KEY)).toBeNull()
      expect(jar.rawValue(MARKER)).toBeUndefined()
    })

    it('does not mark anything when other keys are removed', () => {
      window.localStorage.setItem(KEY, JSON.stringify(sessionWithSid('s1')))
      const storage = makeHybridStorage(DOMAIN, KEY)

      storage.removeItem(`${KEY}-code-verifier`)
      storage.removeItem(`${KEY}-user`)

      expect(jar.rawValue(MARKER)).toBeUndefined()
      expect(window.localStorage.getItem(KEY)).not.toBeNull()
    })

    it.each([
      ['logout', (b: ReturnType<typeof createSupabaseBackend>) => b.auth.logout()],
      ['logoutGlobal', (b: ReturnType<typeof createSupabaseBackend>) => b.auth.logoutGlobal()],
    ] as const)('%s marks the session, also when the request cannot be sent', async (_name, signOut) => {
      window.localStorage.setItem(KEY, JSON.stringify(sessionWithSid('s1')))
      const backend = createSupabaseBackend(makeClient(makeHybridStorage(DOMAIN, KEY), offline))

      await expect(signOut(backend)).rejects.toThrow()

      expect(markerSids(jar)).toEqual(['s1'])
    })

    it('marks the session when the server rejects its refresh', async () => {
      window.localStorage.setItem(KEY, JSON.stringify(sessionWithSid('s1', { expiresAt: nowSec() + 600 })))
      const client = makeClient(makeHybridStorage(DOMAIN, KEY), rejectedRefresh)

      const { error } = await client.auth.refreshSession()

      expect(error).not.toBeNull()
      expect(window.localStorage.getItem(KEY)).toBeNull()
      expect(markerSids(jar)).toEqual(['s1'])
    })
  })

  describe('the shared access-token cookie for a marked session', () => {
    it('is not written by setItem, and an existing one is removed', () => {
      plantMarker(markerValue(['s1']))
      const storage = makeHybridStorage(DOMAIN, KEY)
      jar.plant(KEY, 'stale')

      storage.setItem(KEY, JSON.stringify(sessionWithSid('s1')))

      expect(jar.sharedNames()).toEqual([MARKER])
      expect(window.localStorage.getItem(KEY)).not.toBeNull()
    })

    it('is removed when the storage is created', () => {
      const session = sessionWithSid('s1')
      window.localStorage.setItem(KEY, JSON.stringify(session))
      jar.plant(KEY, JSON.stringify({ access_token: session.access_token, expires_at: session.expires_at }))
      plantMarker(markerValue(['s1']))

      makeHybridStorage(DOMAIN, KEY)

      expect(jar.sharedNames()).toEqual([MARKER])
    })

    it('is not written after a token refresh of that session', async () => {
      window.localStorage.setItem(KEY, JSON.stringify(sessionWithSid('s1', { expiresAt: nowSec() + 600 })))
      plantMarker(markerValue(['s1']))
      const refreshed = sessionWithSid('s1', { refreshToken: 'refresh-token-2' })
      const fetchImpl = ((input: RequestInfo | URL) => Promise.resolve(
        urlOf(input).includes('grant_type=refresh_token') ? jsonResponse(refreshed, 200) : jsonResponse({}, 404),
      )) as unknown as typeof fetch
      const client = makeClient(makeHybridStorage(DOMAIN, KEY), fetchImpl)

      const { error } = await client.auth.refreshSession()

      expect(error).toBeNull()
      expect(JSON.parse(window.localStorage.getItem(KEY)!).refresh_token).toBe('refresh-token-2')
      expect(jar.sharedNames()).toEqual([MARKER])
    })
  })

  describe('a new session', () => {
    it('is not affected by earlier marker entries', () => {
      plantMarker(markerValue(['old-1', 'old-2']))
      window.localStorage.setItem(KEY, JSON.stringify(sessionWithSid('new')))
      const storage = makeHybridStorage(DOMAIN, KEY)
      const backend = createSupabaseBackend(makeClient(storage, offline))

      storage.setItem(KEY, JSON.stringify(sessionWithSid('new')))

      expect(jar.sharedNames()).toEqual([MARKER, KEY])
      expect(backend.auth.isSignedOutElsewhere()).toBe(false)
    })
  })

  describe('backend.auth.isSignedOutElsewhere', () => {
    function backendWith(stored: string | null) {
      if (stored !== null) window.localStorage.setItem(KEY, stored)
      return createSupabaseBackend(makeClient(makeHybridStorage(DOMAIN, KEY), offline))
    }

    it('is true when the stored session is listed in the marker', () => {
      plantMarker(markerValue(['other', 's1']))
      expect(backendWith(JSON.stringify(sessionWithSid('s1'))).auth.isSignedOutElsewhere()).toBe(true)
    })

    it.each([
      ['there is no marker', null, JSON.stringify(sessionWithSid('s1'))],
      ['the marker is malformed', '%E0%A4%A', JSON.stringify(sessionWithSid('s1'))],
      ['there is no stored session', markerValue(['s1']), null],
      ['the stored session has no session id', markerValue(['s1']), JSON.stringify(fullSession())],
    ])('is false when %s', (_label, marker, stored) => {
      if (marker !== null) plantMarker(marker)
      expect(backendWith(stored).auth.isSignedOutElsewhere()).toBe(false)
    })
  })

  describe('following a sign-out from a sibling app', () => {
    function setVisibility(state: DocumentVisibilityState) {
      Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
    }

    function startApp(sid: string) {
      window.localStorage.setItem(KEY, JSON.stringify(sessionWithSid(sid)))
      // Offline: the sign-out request fails, so the local clear (PTSPH-208) runs.
      appBackend.current = createSupabaseBackend(makeClient(makeHybridStorage(DOMAIN, KEY), offline))
      setActivePinia(createPinia())
      const store = useAuthStore()
      useAuth().initAuthListener()
      return store
    }

    afterEach(() => {
      setVisibility('visible')
    })

    it('signs out on start when the stored session is listed', async () => {
      plantMarker(markerValue(['s1']))

      const store = startApp('s1')

      await vi.waitFor(() => expect(mockResetAppToLogin).toHaveBeenCalledOnce())
      expect(window.localStorage.getItem(KEY)).toBeNull()
      expect(store.isAuthenticated).toBe(false)
      expect(jar.sharedNames()).toEqual([MARKER])
    })

    it('keeps an unlisted session signed in on start', async () => {
      plantMarker(markerValue(['old']))

      const store = startApp('s1')

      await vi.waitFor(() => expect(store.loading).toBe(false))
      expect(store.isAuthenticated).toBe(true)
      expect(mockResetAppToLogin).not.toHaveBeenCalled()
    })

    it('signs out when the tab becomes visible after a sign-out elsewhere', async () => {
      const store = startApp('s1')
      await vi.waitFor(() => expect(store.isAuthenticated).toBe(true))

      plantMarker(markerValue(['s1']))
      setVisibility('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      expect(mockResetAppToLogin).not.toHaveBeenCalled()

      setVisibility('visible')
      document.dispatchEvent(new Event('visibilitychange'))

      await vi.waitFor(() => expect(mockResetAppToLogin).toHaveBeenCalledOnce())
      expect(window.localStorage.getItem(KEY)).toBeNull()
      expect(store.isAuthenticated).toBe(false)
    })

    it('signs out on pageshow after a sign-out elsewhere', async () => {
      const store = startApp('s1')
      await vi.waitFor(() => expect(store.isAuthenticated).toBe(true))

      plantMarker(markerValue(['s1']))
      window.dispatchEvent(new Event('pageshow'))

      await vi.waitFor(() => expect(mockResetAppToLogin).toHaveBeenCalledOnce())
      expect(window.localStorage.getItem(KEY)).toBeNull()
    })

    it('stays signed in on those events while the session is not listed', async () => {
      const store = startApp('s1')
      await vi.waitFor(() => expect(store.isAuthenticated).toBe(true))

      plantMarker(markerValue(['someone-else']))
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('pageshow'))

      expect(mockResetAppToLogin).not.toHaveBeenCalled()
      expect(store.isAuthenticated).toBe(true)
    })
  })
})
