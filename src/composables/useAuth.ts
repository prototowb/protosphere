import { backend } from '@/lib/backend'
import { useAuthStore } from '@/stores/auth'

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

  async function logout() {
    await backend.auth.logout()
    authStore.clear()
  }

  async function resetPassword(email: string) {
    await backend.auth.resetPassword(email)
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
    resetPassword,
    initAuthListener,
  }
}
