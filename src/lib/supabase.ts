import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Parent-domain cookie storage for cross-subdomain SSO on protocode.xyz.
 *
 * On `*.protocode.xyz` deployments, we store the Supabase session in a
 * cookie scoped to `.protocode.xyz` instead of localStorage. Sibling
 * subdomains (typescript.protocode.xyz, learn.protocode.xyz, etc.) can
 * then read the same cookie and call `setSession()` to share the auth.
 *
 * Cookie values are chunked across multiple cookies (`<key>.0`, `<key>.1`,
 * ...) when the encoded value would exceed the browser's per-cookie 4KB
 * limit. Supabase session payloads regularly approach that limit when the
 * user has linked identities or extensive metadata, so chunking is not
 * optional. Same approach as @supabase/ssr.
 *
 * Off-domain (localhost dev, vercel previews, etc.) this falls back to
 * undefined → supabase-js defaults to localStorage. No behavior change.
 */
const CHUNK_SIZE = 3180

function makeCookieStorage(domain: string) {
  const baseAttrs = [
    'path=/',
    `domain=${domain}`,
    'max-age=31536000',
    'SameSite=Lax',
    location.protocol === 'https:' ? 'Secure' : '',
  ].filter(Boolean).join('; ')

  const expireAttrs = ['path=/', `domain=${domain}`, 'max-age=0'].join('; ')

  function readMap(): Map<string, string> {
    const map = new Map<string, string>()
    for (const row of document.cookie.split('; ')) {
      const eq = row.indexOf('=')
      if (eq < 0) continue
      try {
        map.set(row.slice(0, eq), decodeURIComponent(row.slice(eq + 1)))
      } catch {
        // Skip values with malformed percent-encoding
      }
    }
    return map
  }

  function clearChunks(key: string) {
    const map = readMap()
    for (let i = 0; map.has(`${key}.${i}`); i++) {
      document.cookie = `${key}.${i}=; ${expireAttrs}`
    }
  }

  return {
    getItem(key: string): string | null {
      const map = readMap()
      if (map.has(key)) return map.get(key)!
      if (!map.has(`${key}.0`)) return null
      let result = ''
      for (let i = 0; map.has(`${key}.${i}`); i++) {
        result += map.get(`${key}.${i}`)!
      }
      return result
    },
    setItem(key: string, value: string): void {
      // Migrate cleanly between modes: clear both unchunked and chunked variants first.
      document.cookie = `${key}=; ${expireAttrs}`
      clearChunks(key)

      if (value.length <= CHUNK_SIZE) {
        document.cookie = `${key}=${encodeURIComponent(value)}; ${baseAttrs}`
        return
      }
      for (let i = 0, off = 0; off < value.length; i++, off += CHUNK_SIZE) {
        const chunk = value.slice(off, off + CHUNK_SIZE)
        document.cookie = `${key}.${i}=${encodeURIComponent(chunk)}; ${baseAttrs}`
      }
    },
    removeItem(key: string): void {
      document.cookie = `${key}=; ${expireAttrs}`
      clearChunks(key)
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
        auth: cookieDomain ? { storage: makeCookieStorage(cookieDomain) } : undefined,
      })
    : null
