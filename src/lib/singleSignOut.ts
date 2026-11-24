/**
 * Single sign-out across protocode.xyz apps.
 *
 * Signing out of any protocode.xyz app signs this browser out of all of them,
 * while one sign-in still covers them all. The apps share a sign-out marker:
 * a cookie on the parent domain that lists the chat session ids that have
 * ended in this browser.
 *
 *   protocode-signout = encodeURIComponent('{"v":1,"sids":["<session_id>", ...]}')
 *   path=/; domain=.protocode.xyz; max-age=2592000 (30 days); SameSite=Lax; Secure (https)
 *
 * `sids` is ordered newest last and holds at most 5 entries. A session id is
 * not a credential: it only names a session that has ended.
 *
 * In this app:
 *   - `lib/supabase.ts` adds the stored session's id whenever that session is
 *     removed from storage (sign-out on this device or everywhere, a token
 *     refresh the server rejects, the local clear after a failed sign-out
 *     request), and doesn't write the shared access-token cookie for a
 *     session that is listed;
 *   - `composables/useAuth.ts` signs out locally when the stored session is
 *     listed: on start, when the tab becomes visible again, and on pageshow.
 *
 * A new sign-in gets a new session id, so earlier entries don't affect it.
 * Every reader here is lenient: a malformed marker is treated as empty and
 * never blocks signing in.
 */

export const SIGNOUT_MARKER_COOKIE = 'protocode-signout'
/** 30 days, in seconds. */
export const SIGNOUT_MARKER_MAX_AGE = 2592000
export const SIGNOUT_MARKER_MAX_SIDS = 5

/** Longest value accepted as a session id (they are UUIDs). */
const MAX_SID_LENGTH = 128

function isSessionId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_SID_LENGTH
}

/**
 * The claims of a JWT, decoded without verifying its signature. Only used on
 * this app's own stored token. Null when the token isn't a decodable JWT.
 */
export function decodeJwtClaims(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1]
  if (!part) return null
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return claims && typeof claims === 'object' && !Array.isArray(claims)
      ? (claims as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** The `session_id` claim of an access token, or null. */
export function sessionIdOfToken(token: unknown): string | null {
  if (typeof token !== 'string' || token === '') return null
  const sid = decodeJwtClaims(token)?.session_id
  return isSessionId(sid) ? sid : null
}

/** The session id of a stored supabase-js session (its JSON string), or null. */
export function sessionIdOfStoredSession(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object') return null
    return sessionIdOfToken((parsed as Record<string, unknown>).access_token)
  } catch {
    return null
  }
}

/** The session ids in one decoded marker value. Empty when it is malformed. */
export function parseSignOutMarker(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object') return []
    const { v, sids } = parsed as Record<string, unknown>
    if (v !== 1 || !Array.isArray(sids)) return []
    return sids.filter(isSessionId)
  } catch {
    return []
  }
}

/**
 * The session ids listed in the marker cookie(s) visible to this page, in
 * order, without duplicates.
 */
export function readSignedOutSessionIds(): string[] {
  let cookieString: string
  try {
    cookieString = document.cookie
  } catch {
    return []
  }
  const prefix = `${SIGNOUT_MARKER_COOKIE}=`
  const sids: string[] = []
  for (const row of cookieString.split(/;\s*/)) {
    if (!row.startsWith(prefix)) continue
    let decoded: string
    try {
      decoded = decodeURIComponent(row.slice(prefix.length))
    } catch {
      continue
    }
    for (const sid of parseSignOutMarker(decoded)) {
      if (!sids.includes(sid)) sids.push(sid)
    }
  }
  return sids
}

/** Whether a session id is listed in the sign-out marker. */
export function isSessionSignedOut(sid: string | null | undefined): boolean {
  if (!sid) return false
  return readSignedOutSessionIds().includes(sid)
}

/**
 * Add a session id to the sign-out marker on `domain` (newest last, at most
 * SIGNOUT_MARKER_MAX_SIDS entries). An existing malformed marker is
 * replaced. Never throws.
 */
export function markSessionSignedOut(sid: string, domain: string): void {
  if (!isSessionId(sid)) return
  try {
    const sids = readSignedOutSessionIds().filter((s) => s !== sid)
    sids.push(sid)
    const value = encodeURIComponent(JSON.stringify({ v: 1, sids: sids.slice(-SIGNOUT_MARKER_MAX_SIDS) }))
    const attrs = [
      'path=/',
      `domain=${domain}`,
      `max-age=${SIGNOUT_MARKER_MAX_AGE}`,
      'SameSite=Lax',
      location.protocol === 'https:' ? 'Secure' : '',
    ].filter(Boolean).join('; ')
    document.cookie = `${SIGNOUT_MARKER_COOKIE}=${value}; ${attrs}`
  } catch {
    // Cookies unavailable: nothing to share with sibling apps.
  }
}

/**
 * Run `check` whenever the page may have missed a sign-out elsewhere: when
 * the tab becomes visible again, and on pageshow (including a page restored
 * from the back/forward cache). Returns a function that removes the
 * listeners.
 */
export function watchSignOutMarker(check: () => void): () => void {
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') check()
  }
  const onPageShow = () => check()
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pageshow', onPageShow)
  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pageshow', onPageShow)
  }
}
