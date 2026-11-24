// Full in-memory reset after the signed-in user changes.
//
// Session-scoped state lives in many places: Pinia stores (messages, DMs,
// servers, roles, mutes…), module-level composable caches (presence override,
// cached @mention username), and long-lived realtime channels (global
// presence). Clearing each one by hand is fragile — any store added later is
// silently left holding the previous user's data. A full document navigation
// discards all of it by construction, which is the right trade for an action
// as rare as signing out.

type ResetLocation = Pick<Location, 'pathname' | 'search' | 'assign'>

/**
 * Navigate to the login page with a full reload.
 *
 * When the page is already `/login`, its query string is kept, so a
 * `?redirect=` from a sibling app survives a sign-out that ended there (for
 * example when the stored session was signed out elsewhere and is cleared on
 * load).
 */
export function resetAppToLogin(loc: ResetLocation = window.location): void {
  const keep = loc.pathname === '/login' ? loc.search : ''
  loc.assign(`/login${keep}`)
}
