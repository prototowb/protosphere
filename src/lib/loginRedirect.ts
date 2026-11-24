/**
 * Return after sign-in.
 *
 * `/login?redirect=<target>` sends the visitor to <target> once they are
 * signed in, including after an OAuth round trip and when they were already
 * signed in. Sibling protocode.xyz apps link here with their own URL as the
 * target, so a sign-in that starts there comes back there.
 *
 * Accepted targets:
 *   - an in-app path that starts with exactly one `/` (not `//` or `/\`);
 *   - an absolute `https:` URL on protocode.xyz or one of its subdomains,
 *     without credentials;
 *   - in local development, also `http:`/`https:` on localhost or 127.0.0.1.
 * Anything else falls back to DEFAULT_LOGIN_REDIRECT.
 */
import type { Router } from 'vue-router'

export const DEFAULT_LOGIN_REDIRECT = '/channels/@me'

export interface LoginRedirect {
  /** In-app path, or an absolute URL when `external`. */
  href: string
  external: boolean
}

export interface LoginRedirectOptions {
  /** Accept http(s)://localhost and 127.0.0.1. Defaults to dev builds only. */
  allowLocalhost?: boolean
}

const FALLBACK: LoginRedirect = { href: DEFAULT_LOGIN_REDIRECT, external: false }

// Control characters, whitespace and backslashes are never needed in a
// target, and URL parsers drop or reinterpret some of them.
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS = /[\u0000- \u007f-\u009f\\]/

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

function isProtocodeHost(hostname: string): boolean {
  return hostname === 'protocode.xyz' || hostname.endsWith('.protocode.xyz')
}

/** The target to go to after sign-in, for a raw `redirect` query value. */
export function resolveLoginRedirect(raw: unknown, options: LoginRedirectOptions = {}): LoginRedirect {
  if (typeof raw !== 'string' || raw === '' || raw.length > 2048 || UNSAFE_CHARS.test(raw)) return FALLBACK

  if (raw.startsWith('/')) {
    if (raw.startsWith('//')) return FALLBACK
    // Must stay on this origin once resolved.
    const base = 'https://app.invalid'
    try {
      if (new URL(raw, base).origin !== base) return FALLBACK
    } catch {
      return FALLBACK
    }
    return { href: raw, external: false }
  }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return FALLBACK
  }
  if (url.username !== '' || url.password !== '') return FALLBACK

  const allowLocalhost = options.allowLocalhost ?? import.meta.env.DEV
  const hostname = url.hostname.toLowerCase()
  const allowed =
    (url.protocol === 'https:' && isProtocodeHost(hostname)) ||
    (allowLocalhost && (url.protocol === 'http:' || url.protocol === 'https:') && LOCAL_HOSTS.has(hostname))
  return allowed ? { href: url.href, external: true } : FALLBACK
}

// ── Kept across the OAuth round trip ────────────────────────────────────────

const PENDING_KEY = 'protosphere-login-redirect'
/** A pending redirect older than this is ignored. */
export const PENDING_LOGIN_REDIRECT_TTL_MS = 10 * 60 * 1000

/**
 * Remember the target before leaving for an OAuth provider (sessionStorage,
 * so per tab). Without a usable target any earlier one is cleared.
 */
export function rememberLoginRedirect(raw: unknown, now = Date.now()): void {
  try {
    const target = resolveLoginRedirect(raw)
    if (typeof raw !== 'string' || target === FALLBACK) {
      window.sessionStorage.removeItem(PENDING_KEY)
      return
    }
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify({ redirect: raw, at: now }))
  } catch {
    // Storage unavailable: the visitor lands on the default page.
  }
}

/** Forget any pending target. */
export function clearLoginRedirect(): void {
  try {
    window.sessionStorage.removeItem(PENDING_KEY)
  } catch {
    // Storage unavailable.
  }
}

/**
 * Read and clear the pending target. It is checked again here, and null when
 * missing, malformed, expired or not allowed.
 */
export function takeLoginRedirect(now = Date.now()): LoginRedirect | null {
  let stored: string | null
  try {
    stored = window.sessionStorage.getItem(PENDING_KEY)
    window.sessionStorage.removeItem(PENDING_KEY)
  } catch {
    return null
  }
  if (!stored) return null
  try {
    const { redirect, at } = JSON.parse(stored) as { redirect?: unknown; at?: unknown }
    if (typeof at !== 'number' || now - at < 0 || now - at > PENDING_LOGIN_REDIRECT_TTL_MS) return null
    const target = resolveLoginRedirect(redirect)
    return target === FALLBACK ? null : target
  } catch {
    return null
  }
}

/** Go to a resolved target: a full navigation for an absolute URL. */
export function followLoginRedirect(router: Router, target: LoginRedirect): void {
  if (target.external) {
    window.location.assign(target.href)
    return
  }
  router.push(target.href).catch(() => {})
}
