import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isSessionSignedOut, markSessionSignedOut, sessionIdOfStoredSession } from '@/lib/singleSignOut'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Hybrid session storage for cross-subdomain SSO on protocode.xyz.
 *
 *   - localStorage (origin-scoped) holds the full session. It is the only
 *     store this app reads its own session from.
 *   - A cookie on `.protocode.xyz` holds a minimal, short-lived copy for
 *     sibling subdomains, which exchange the access token server-side for a
 *     session of their own (Protocode Learn's auth-bridge):
 *
 *       <key> = encodeURIComponent('{"access_token":"<jwt>","expires_at":<unix s>}')
 *       path=/; domain=.protocode.xyz; max-age=<expires_at - now>; SameSite=Lax; Secure (https)
 *
 *     It is rewritten on every setItem (sign-in and each token refresh) and
 *     expires together with the access token it carries.
 *
 * When the storage is created, the cookie is brought in line with the
 * localStorage session: rewritten in the minimal format, or removed when
 * there is no session. supabase-js doesn't call setItem on a load where the
 * stored session is still valid, so this is also what replaces a cookie
 * written by an earlier build.
 *
 * Single sign-out across protocode.xyz apps (see lib/singleSignOut.ts):
 * removing the stored session adds its session id to the shared
 * `protocode-signout` marker, and the shared cookie is never written for a
 * session the marker lists.
 *
 * A value over the per-cookie 4 KB limit is chunked (`<key>.0`, `<key>.1`,
 * ...), matching the `@supabase/ssr` scheme. The minimal value is about
 * 1 KB, so in practice it is a single cookie, which also keeps the Cookie
 * header on every protocode.xyz request small.
 *
 * Off-domain (localhost dev, vercel previews, etc.) this isn't used and
 * supabase-js defaults to localStorage.
 */
const CHUNK_SIZE = 3180

export function makeHybridStorage(domain: string, sessionKey: string) {
  const secure = location.protocol === 'https:'
  const expireAttrs = ['path=/', `domain=${domain}`, 'max-age=0'].join('; ')

  function sharedAttrs(maxAge: number): string {
    return [
      'path=/',
      `domain=${domain}`,
      `max-age=${maxAge}`,
      'SameSite=Lax',
      secure ? 'Secure' : '',
    ].filter(Boolean).join('; ')
  }

  function readCookieMap(): Map<string, string> {
    const map = new Map<string, string>()
    for (const row of document.cookie.split('; ')) {
      const eq = row.indexOf('=')
      if (eq < 0) continue
      try {
        map.set(row.slice(0, eq), decodeURIComponent(row.slice(eq + 1)))
      } catch {
        // Skip malformed percent-encoding
      }
    }
    return map
  }

  function clearCookieChunks(key: string) {
    const map = readCookieMap()
    for (let i = 0; map.has(`${key}.${i}`); i++) {
      document.cookie = `${key}.${i}=; ${expireAttrs}`
    }
  }

  function removeCookie(key: string) {
    document.cookie = `${key}=; ${expireAttrs}`
    clearCookieChunks(key)
  }

  function writeCookie(key: string, value: string, maxAge: number) {
    // Clear stale single + chunked forms before writing
    removeCookie(key)

    const attrs = sharedAttrs(maxAge)
    if (value.length <= CHUNK_SIZE) {
      document.cookie = `${key}=${encodeURIComponent(value)}; ${attrs}`
      return
    }
    for (let i = 0, off = 0; off < value.length; i++, off += CHUNK_SIZE) {
      const chunk = value.slice(off, off + CHUNK_SIZE)
      document.cookie = `${key}.${i}=${encodeURIComponent(chunk)}; ${attrs}`
    }
  }

  /**
   * The shared-cookie payload for a stored value: only the access token and
   * its expiry, with the seconds left until that expiry. Null for values
   * that aren't a session (PKCE code verifier, etc.).
   */
  function sharedPayload(value: string): { payload: string; maxAge: number } | null {
    let parsed: unknown
    try {
      parsed = JSON.parse(value)
    } catch {
      return null
    }
    if (!parsed || typeof parsed !== 'object') return null
    const { access_token, expires_at } = parsed as Record<string, unknown>
    if (typeof access_token !== 'string' || access_token === '') return null
    if (typeof expires_at !== 'number' || !Number.isFinite(expires_at)) return null
    return {
      payload: JSON.stringify({ access_token, expires_at }),
      maxAge: Math.max(0, Math.floor(expires_at - Date.now() / 1000)),
    }
  }

  function syncSharedCookie(key: string, value: string | null) {
    const shared = value === null ? null : sharedPayload(value)
    if (!shared || shared.maxAge === 0 || isSessionSignedOut(sessionIdOfStoredSession(value))) {
      removeCookie(key)
      return
    }
    writeCookie(key, shared.payload, shared.maxAge)
  }

  try {
    syncSharedCookie(sessionKey, window.localStorage.getItem(sessionKey))
  } catch {
    // Storage or cookies unavailable; supabase-js surfaces that on first use.
  }

  return {
    getItem(key: string): string | null {
      // localStorage only. The shared cookie carries no refresh token, so a
      // session restored from it couldn't be refreshed.
      return window.localStorage.getItem(key)
    },
    setItem(key: string, value: string): void {
      window.localStorage.setItem(key, value)
      syncSharedCookie(key, value)
    },
    removeItem(key: string): void {
      if (key === sessionKey) {
        // The session ends in this browser: tell sibling apps.
        const sid = sessionIdOfStoredSession(window.localStorage.getItem(key))
        if (sid) markSessionSignedOut(sid, domain)
      }
      window.localStorage.removeItem(key)
      removeCookie(key)
    },
  }
}

/**
 * supabase-js's default storage key, `sb-<project ref>-auth-token`. Passed
 * explicitly so the shared cookie name stays fixed across supabase-js
 * upgrades.
 */
function sessionStorageKey(url: string): string {
  return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`
}

const hostname = typeof window !== 'undefined' ? window.location?.hostname : undefined
const cookieDomain = hostname && (hostname.endsWith('.protocode.xyz') || hostname === 'protocode.xyz')
  ? '.protocode.xyz'
  : null

function authOptions(url: string) {
  if (!cookieDomain) return undefined
  const storageKey = sessionStorageKey(url)
  return { storage: makeHybridStorage(cookieDomain, storageKey), storageKey }
}

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, { auth: authOptions(supabaseUrl) })
    : null
