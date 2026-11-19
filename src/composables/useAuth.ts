import { backend } from '@/lib/backend'
import { useAuthStore } from '@/stores/auth'
import { resetAppToLogin } from '@/lib/sessionReset'

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

  async function resetPassword(email: string) {
    await backend.auth.resetPassword(email)
  }

  async function updatePassword(newPassword: string) {
    await backend.auth.updatePassword(newPassword)
  }

  function initAuthListener() {
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
