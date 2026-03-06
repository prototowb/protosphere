import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

type TabMessage = { type: 'logout' } | { type: 'login' }

const SESSION_CHANNEL = 'protosphere_session_sync'

/**
 * PTSPH-160: Syncs login/logout state across browser tabs via BroadcastChannel.
 * Mount this once in AppShell or App.vue.
 */
export function useSessionSync() {
  const authStore = useAuthStore()
  const router = useRouter()
  const sessionExpired = ref(false)

  let channel: BroadcastChannel | null = null

  function broadcastLogout() {
    channel?.postMessage({ type: 'logout' } satisfies TabMessage)
  }

  function broadcastLogin() {
    channel?.postMessage({ type: 'login' } satisfies TabMessage)
  }

  function dismissExpired() {
    sessionExpired.value = false
    router.push({ name: 'login' })
  }

  onMounted(() => {
    if (!('BroadcastChannel' in window)) return
    channel = new BroadcastChannel(SESSION_CHANNEL)
    channel.onmessage = (event: MessageEvent<TabMessage>) => {
      if (event.data.type === 'logout' && authStore.isAuthenticated) {
        sessionExpired.value = true
        authStore.clear()
      }
      if (event.data.type === 'login' && !authStore.isAuthenticated) {
        // Another tab logged in — reload to pick up the session
        window.location.reload()
      }
    }
  })

  onUnmounted(() => {
    channel?.close()
    channel = null
  })

  return { sessionExpired, broadcastLogout, broadcastLogin, dismissExpired }
}
