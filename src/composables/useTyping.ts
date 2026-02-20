import { ref, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const TYPING_KEY = 'protocode_typing'
const TYPING_EXPIRE_MS = 4000
const STOP_AFTER_MS = 3000

type TypingEntry = { displayName: string; ts: number }
type TypingMap = Record<string, Record<string, TypingEntry>>

function readTyping(): TypingMap {
  try {
    return JSON.parse(localStorage.getItem(TYPING_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeTyping(map: TypingMap) {
  localStorage.setItem(TYPING_KEY, JSON.stringify(map))
}

export function useTyping(getChannelId: () => string | null) {
  const authStore = useAuthStore()
  const typingUsers = ref<string[]>([])
  let stopTimer: ReturnType<typeof setTimeout> | null = null
  let pollInterval: ReturnType<typeof setInterval> | null = null

  function notifyTyping() {
    const channelId = getChannelId()
    if (!channelId || !authStore.user?.id) return
    const map = readTyping()
    if (!map[channelId]) map[channelId] = {}
    map[channelId][authStore.user.id] = {
      displayName: authStore.user.email?.split('@')[0] ?? 'Someone',
      ts: Date.now(),
    }
    writeTyping(map)
    // Notify other tabs
    window.dispatchEvent(new StorageEvent('storage', { key: TYPING_KEY }))
  }

  function clearSelf() {
    const channelId = getChannelId()
    if (!channelId || !authStore.user?.id) return
    const map = readTyping()
    if (map[channelId]?.[authStore.user.id]) {
      delete map[channelId][authStore.user.id]
      writeTyping(map)
    }
  }

  function refreshTypingUsers() {
    const channelId = getChannelId()
    if (!channelId) { typingUsers.value = []; return }
    const map = readTyping()
    const now = Date.now()
    const channel = map[channelId] ?? {}
    typingUsers.value = Object.entries(channel)
      .filter(([uid, e]) => uid !== authStore.user?.id && now - e.ts < TYPING_EXPIRE_MS)
      .map(([, e]) => e.displayName)
  }

  // Called from the message input's keydown handler
  function onTyping() {
    notifyTyping()
    if (stopTimer) clearTimeout(stopTimer)
    stopTimer = setTimeout(() => { clearSelf(); refreshTypingUsers() }, STOP_AFTER_MS)
  }

  function onSent() {
    clearSelf()
    if (stopTimer) clearTimeout(stopTimer)
    refreshTypingUsers()
  }

  function startListening() {
    refreshTypingUsers()
    window.addEventListener('storage', refreshTypingUsers)
    pollInterval = setInterval(refreshTypingUsers, 1000)
  }

  function stopListening() {
    clearSelf()
    window.removeEventListener('storage', refreshTypingUsers)
    if (pollInterval) clearInterval(pollInterval)
    if (stopTimer) clearTimeout(stopTimer)
  }

  onUnmounted(stopListening)

  return { typingUsers, onTyping, onSent, startListening, stopListening }
}
