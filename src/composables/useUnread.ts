import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useMessagesStore } from '@/stores/messages'

const READ_STATE_KEY = 'protosphere_read_state'

type ReadState = Record<string, Record<string, string>> // userId → channelId → ISO timestamp

function readState(): ReadState {
  try {
    return JSON.parse(localStorage.getItem(READ_STATE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function useUnread() {
  const authStore = useAuthStore()
  const messagesStore = useMessagesStore()
  // Reactive set of unread channel ids — updated manually
  const unreadChannelIds = ref<Set<string>>(new Set())

  function markRead(channelId: string) {
    const userId = authStore.user?.id
    if (!userId) return
    const state = readState()
    if (!state[userId]) state[userId] = {}
    state[userId][channelId] = new Date().toISOString()
    localStorage.setItem(READ_STATE_KEY, JSON.stringify(state))
    unreadChannelIds.value.delete(channelId)
    // trigger reactivity
    unreadChannelIds.value = new Set(unreadChannelIds.value)
  }

  function refreshUnread(channelIds: string[]) {
    const userId = authStore.user?.id
    if (!userId) { unreadChannelIds.value = new Set(); return }
    const state = readState()
    const userState = state[userId] ?? {}
    const unread = new Set<string>()

    for (const channelId of channelIds) {
      const lastRead = userState[channelId]
      const msgs = messagesStore.messagesByChannel[channelId]
      if (!msgs || msgs.length === 0) continue

      if (!lastRead) {
        // Never visited — only unread if there are messages from others
        if (msgs.some((m) => m.author_id !== userId)) unread.add(channelId)
      } else {
        // Unread if any message from others is newer than last read
        if (msgs.some((m) => m.author_id !== userId && m.created_at > lastRead)) {
          unread.add(channelId)
        }
      }
    }
    unreadChannelIds.value = unread
  }

  return { unreadChannelIds, markRead, refreshUnread }
}
