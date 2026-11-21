// Full in-memory reset after the signed-in user changes.
//
// Session-scoped state lives in many places: Pinia stores (messages, DMs,
// servers, roles, mutes…), module-level composable caches (presence override,
// cached @mention username), and long-lived realtime channels (global
// presence). Clearing each one by hand is fragile — any store added later is
// silently left holding the previous user's data. A full document navigation
// discards all of it by construction, which is the right trade for an action
// as rare as signing out.

/** Navigate to the login page with a full reload. */
export function resetAppToLogin(): void {
  window.location.assign('/login')
}
