import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Session, User } from '@supabase/supabase-js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const loading = ref(true)

  function setSession(newSession: Session | null) {
    session.value = newSession
    user.value = newSession?.user ?? null
  }

  function clear() {
    session.value = null
    user.value = null
  }

  return { user, session, loading, setSession, clear }
})
