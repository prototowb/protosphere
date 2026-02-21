import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { backend } from '@/lib/backend'
import type { UserStatus } from '@/lib/types'

const IDLE_TIMEOUT = 5 * 60 * 1000 // 5 minutes

// Manual override: 'dnd' | 'offline' block auto behavior; null = auto
const manualOverride = ref<UserStatus | null>(null)

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
    idleTimer = setTimeout(() => {
      if (manualOverride.value) return
      setStatus('idle')
    }, IDLE_TIMEOUT)
  }

  function handleActivity() {
    if (manualOverride.value) return
    if (currentStatus.value === 'idle') setStatus('online')
    resetIdleTimer()
  }

  function handleVisibilityChange() {
    if (manualOverride.value) return
    if (document.hidden) {
      setStatus('offline')
    } else {
      setStatus('online')
      resetIdleTimer()
    }
  }

  function setManualStatus(status: UserStatus) {
    if (status === 'online') {
      // Clear override, resume auto behavior
      manualOverride.value = null
      setStatus(status)
      resetIdleTimer()
    } else {
      // Idle, DND, or Invisible — lock status, block auto behavior
      manualOverride.value = status
      setStatus(status)
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

  return { currentStatus, setManualStatus }
}
