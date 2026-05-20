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
 * Off-domain (localhost dev, vercel previews, etc.) this falls back to
 * undefined → supabase-js defaults to localStorage. No behavior change.
 *
 * Cookie size note: Supabase JS chunks the session into multiple cookies
 * if needed (sb-<ref>-auth-token, sb-<ref>-auth-token.0, .1, ...) so the
 * 4KB-per-cookie limit is not a concern for typical session payloads.
 */
function makeCookieStorage(domain: string) {
  return {
    getItem(key: string): string | null {
      const match = document.cookie.split('; ').find((row) => row.startsWith(`${key}=`))
      return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null
    },
    setItem(key: string, value: string): void {
      const opts = [
        'path=/',
        `domain=${domain}`,
        'max-age=31536000',
        'SameSite=Lax',
        location.protocol === 'https:' ? 'Secure' : '',
      ].filter(Boolean).join('; ')
      document.cookie = `${key}=${encodeURIComponent(value)}; ${opts}`
    },
    removeItem(key: string): void {
      const opts = ['path=/', `domain=${domain}`, 'max-age=0'].join('; ')
      document.cookie = `${key}=; ${opts}`
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
