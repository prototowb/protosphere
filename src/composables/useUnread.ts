import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useMessagesStore } from '@/stores/messages'
import { useNotificationPreferences } from '@/composables/useNotificationPreferences'
import { isChannelUnread } from '@/lib/unread'

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
  const { getCached } = useNotificationPreferences()
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
      // Skip channels with notifications muted
      if (getCached(channelId) === 'none') continue

      const msgs = messagesStore.messagesByChannel[channelId]
      if (!msgs || msgs.length === 0) continue

      if (isChannelUnread(msgs, userState[channelId], userId)) unread.add(channelId)
    }
    unreadChannelIds.value = unread
  }

  return { unreadChannelIds, markRead, refreshUnread }
}
