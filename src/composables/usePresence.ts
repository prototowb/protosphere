import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { backend } from '@/lib/backend'
import type { UserStatus } from '@/lib/types'

const IDLE_TIMEOUT = 5 * 60 * 1000 // 5 minutes

export function usePresence() {
  const authStore = useAuthStore()
  const currentStatus = ref<UserStatus>('online')
  let idleTimer: ReturnType<typeof setTimeout> | null = null

  async function setStatus(status: UserStatus) {
    currentStatus.value = status
    if (!authStore.user?.id) return
    try {
      await backend.profiles.update(authStore.user.id, { status })
    } catch {
      // best-effort
    }
  }

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => setStatus('idle'), IDLE_TIMEOUT)
  }

  function handleActivity() {
    if (currentStatus.value === 'idle') setStatus('online')
    resetIdleTimer()
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      setStatus('offline')
    } else {
      setStatus('online')
      resetIdleTimer()
    }
  }

  // Synchronous write on unload — async won't complete in time
  function handleBeforeUnload() {
    const id = authStore.user?.id
    if (!id) return
    try {
      const raw = localStorage.getItem('protosphere_profiles')
      const profiles = raw ? JSON.parse(raw) : {}
      if (profiles[id]) {
        profiles[id].status = 'offline'
        localStorage.setItem('protosphere_profiles', JSON.stringify(profiles))
      }
    } catch { /* ignore */ }
  }

  onMounted(() => {
    setStatus('online')
    resetIdleTimer()
    window.addEventListener('mousemove', handleActivity, { passive: true })
    window.addEventListener('keydown', handleActivity, { passive: true })
    window.addEventListener('click', handleActivity, { passive: true })
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
  })

  onUnmounted(() => {
    if (idleTimer) clearTimeout(idleTimer)
    window.removeEventListener('mousemove', handleActivity)
    window.removeEventListener('keydown', handleActivity)
    window.removeEventListener('click', handleActivity)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('beforeunload', handleBeforeUnload)
  })

  return { currentStatus }
}
