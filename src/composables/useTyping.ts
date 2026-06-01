import { ref, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { TYPING_EXPIRE_MS, STOP_AFTER_MS } from '@/lib/typing'

const TYPING_KEY = 'protosphere_typing'

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

export function useTyping(getChannelId: () => string | null, getDisplayName?: () => string) {
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
      displayName: getDisplayName?.() ?? authStore.user.email?.split('@')[0] ?? 'Someone',
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
      .filter(([, e]) => now - e.ts < TYPING_EXPIRE_MS)
      .map(([, e]) => e.displayName)
  }

  // Called from the message input's keydown handler
  function onTyping() {
    notifyTyping()
    refreshTypingUsers()
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
    pollInterval = setInterval(refreshTypingUsers, 500)
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
