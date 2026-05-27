import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Hybrid session storage for cross-subdomain SSO on protocode.xyz.
 *
 * Two stores, written together, read in order:
 *   - localStorage (origin-scoped) — full session, used by this app and not
 *     sent over the wire.
 *   - cookie on `.protocode.xyz` — *compact* session (heavy nested fields
 *     stripped) so sibling subdomains can read it via their own auth-bridge
 *     and call `setSession()`. Supabase refetches the full user via the API
 *     after restoring tokens, so dropping `identities` and metadata is safe.
 *
 * Why compact: the full session JSON routinely runs 3–5 KB. Once stored in
 * a cookie at `.protocode.xyz`, that bloat rides along on every request to
 * chat.protocode.xyz, blowing past Apache's `LimitRequestFieldSize` (~8 KB
 * default on Netcup) and producing 400s on dynamic-import chunks. Compacting
 * trims the cookie to ~1.5 KB.
 *
 * The cookie is still chunked (`<key>.0`, `<key>.1`, ...) as a defensive
 * fallback in case the compact value still exceeds the per-cookie 4 KB
 * limit, matching the `@supabase/ssr` scheme.
 *
 * Off-domain (localhost dev, vercel previews, etc.) this returns undefined
 * → supabase-js defaults to localStorage. No behavior change.
 */
const CHUNK_SIZE = 3180

function makeHybridStorage(domain: string) {
  const baseAttrs = [
    'path=/',
    `domain=${domain}`,
    'max-age=31536000',
    'SameSite=Lax',
    location.protocol === 'https:' ? 'Secure' : '',
  ].filter(Boolean).join('; ')

  const expireAttrs = ['path=/', `domain=${domain}`, 'max-age=0'].join('; ')

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

  function readCookie(key: string): string | null {
    const map = readCookieMap()
    if (map.has(key)) return map.get(key)!
    if (!map.has(`${key}.0`)) return null
    let acc = ''
    for (let i = 0; map.has(`${key}.${i}`); i++) {
      acc += map.get(`${key}.${i}`)!
    }
    return acc
  }

  function writeCookie(key: string, value: string) {
    // Clear stale single + chunked forms before writing
    document.cookie = `${key}=; ${expireAttrs}`
    clearCookieChunks(key)

    if (value.length <= CHUNK_SIZE) {
      document.cookie = `${key}=${encodeURIComponent(value)}; ${baseAttrs}`
      return
    }
    for (let i = 0, off = 0; off < value.length; i++, off += CHUNK_SIZE) {
      const chunk = value.slice(off, off + CHUNK_SIZE)
      document.cookie = `${key}.${i}=${encodeURIComponent(chunk)}; ${baseAttrs}`
    }
  }

  function removeCookie(key: string) {
    document.cookie = `${key}=; ${expireAttrs}`
    clearCookieChunks(key)
  }

  /**
   * Drop the heavy nested fields from a session JSON. Supabase will refetch
   * the user via the API after `setSession()`, so identities and metadata
   * aren't load-bearing for auth.
   */
  function compactSession(value: string): string {
    try {
      const session = JSON.parse(value)
      if (
        !session ||
        typeof session !== 'object' ||
        typeof session.access_token !== 'string' ||
        typeof session.refresh_token !== 'string'
      ) {
        return value
      }
      const out: Record<string, unknown> = { ...session }
      if (session.user && typeof session.user === 'object') {
        const u = { ...(session.user as Record<string, unknown>) }
        delete u.identities
        delete u.user_metadata
        delete u.app_metadata
        out.user = u
      }
      return JSON.stringify(out)
    } catch {
      return value
    }
  }

  return {
    getItem(key: string): string | null {
      // localStorage holds the full session for this app.
      const local = window.localStorage.getItem(key)
      if (local !== null) return local
      // Fall back to the cross-subdomain cookie (compact session) on first
      // visit after coming from a sibling subdomain.
      return readCookie(key)
    },
    setItem(key: string, value: string): void {
      window.localStorage.setItem(key, value)
      writeCookie(key, compactSession(value))
    },
    removeItem(key: string): void {
      window.localStorage.removeItem(key)
      removeCookie(key)
    },
  }
}

const cookieDomain = typeof window !== 'undefined'
  && (window.location.hostname.endsWith('.protocode.xyz') || window.location.hostname === 'protocode.xyz')
    ? '.protocode.xyz'
    : null

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: cookieDomain ? { storage: makeHybridStorage(cookieDomain) } : undefined,
      })
    : null
