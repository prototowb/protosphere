import { backend } from '@/lib/backend'
import { useAuthStore } from '@/stores/auth'
import { resetAppToLogin } from '@/lib/sessionReset'
import { watchSignOutMarker } from '@/lib/singleSignOut'

// Single sign-out across protocode.xyz apps (lib/singleSignOut.ts). One
// listener set per page, and one sign-out at a time.
let stopSignOutWatch: (() => void) | null = null
let followingSignOut = false

export function useAuth() {
  const authStore = useAuthStore()

  async function login(email: string, password: string) {
    await backend.auth.login(email, password)
  }

  async function register(email: string, password: string, username: string) {
    return backend.auth.register(email, password, username)
  }

  async function loginWithOAuth(provider: string) {
    await backend.auth.loginWithOAuth(provider)
  }

  // Sign-out always ends with a full reload, even if the network call fails:
  // a partial client-side clear would leave other stores and realtime
  // channels holding the previous user's data (see lib/sessionReset).
  async function logout() {
    try {
      await backend.auth.logout()
    } finally {
      authStore.clear()
      resetAppToLogin()
    }
  }

  async function logoutGlobal() {
    try {
      await backend.auth.logoutGlobal()
    } finally {
      authStore.clear()
      resetAppToLogin()
    }
  }

  /**
   * When another protocode.xyz app has ended this browser's session, sign
   * out here too: locally only (the session has already ended), with the
   * same local clear and reload to /login as a manual sign-out, even when
   * the request fails. Returns whether a sign-out was started.
   */
  function followSignOutElsewhere(): boolean {
    if (followingSignOut) return true
    if (!backend.auth.isSignedOutElsewhere()) return false
    followingSignOut = true
    logout()
      .catch(() => {
        // logout() has already cleared the session and reset the app.
      })
      .finally(() => {
        followingSignOut = false
      })
    return true
  }

  async function resetPassword(email: string) {
    await backend.auth.resetPassword(email)
  }

  async function updatePassword(newPassword: string) {
    await backend.auth.updatePassword(newPassword)
  }

  function initAuthListener() {
    stopSignOutWatch?.()
    stopSignOutWatch = watchSignOutMarker(() => {
      followSignOutElsewhere()
    })
    // On start, don't publish a session that has already ended elsewhere;
    // the sign-out reloads the app at /login.
    if (followSignOutElsewhere()) return

    backend.auth.init((session) => {
      authStore.setSession(session)
      authStore.loading = false
    })
  }

  return {
    login,
    register,
    loginWithOAuth,
    logout,
    logoutGlobal,
    resetPassword,
    updatePassword,
    initAuthListener,
  }
}
