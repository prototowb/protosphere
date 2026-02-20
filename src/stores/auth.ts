import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AuthUser, AuthSession } from '@/lib/backend/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const session = ref<AuthSession | null>(null)
  const loading = ref(true)

  const isAuthenticated = computed(() => !!session.value)

  function setSession(newSession: AuthSession | null) {
    session.value = newSession
    user.value = newSession?.user ?? null
  }

  function clear() {
    session.value = null
    user.value = null
  }

  return { user, session, loading, isAuthenticated, setSession, clear }
})
