import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useDmsStore } from '@/stores/dms'

const DM_READ_STATE_KEY = 'protosphere_dm_read_state'

// userId → dmGroupId → lastReadAt
type DmReadState = Record<string, Record<string, string>>

function readState(): DmReadState {
  try {
    return JSON.parse(localStorage.getItem(DM_READ_STATE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function useDmUnread() {
  const authStore = useAuthStore()
  const dmsStore = useDmsStore()

  const unreadDmGroupIds = ref<Set<string>>(new Set())
  const totalDmUnread = ref(0)

  function markDmRead(dmGroupId: string) {
    const userId = authStore.user?.id
    if (!userId) return
    const state = readState()
    if (!state[userId]) state[userId] = {}
    state[userId][dmGroupId] = new Date().toISOString()
    localStorage.setItem(DM_READ_STATE_KEY, JSON.stringify(state))
    unreadDmGroupIds.value.delete(dmGroupId)
    unreadDmGroupIds.value = new Set(unreadDmGroupIds.value)
    recountTotal()
  }

  function refreshDmUnread() {
    const userId = authStore.user?.id
    if (!userId) { unreadDmGroupIds.value = new Set(); totalDmUnread.value = 0; return }
    const state = readState()
    const userState = state[userId] ?? {}
    const unread = new Set<string>()

    for (const group of dmsStore.groups) {
      const lastRead = userState[group.id]
      const msgs = dmsStore.messagesByGroup[group.id]
      if (!msgs || msgs.length === 0) continue

      const hasUnread = lastRead
        ? msgs.some((m) => m.author_id !== userId && m.created_at > lastRead)
        : msgs.some((m) => m.author_id !== userId)

      if (hasUnread) unread.add(group.id)
    }

    unreadDmGroupIds.value = unread
    recountTotal()
  }

  function recountTotal() {
    totalDmUnread.value = unreadDmGroupIds.value.size
  }

  return { unreadDmGroupIds, totalDmUnread, markDmRead, refreshDmUnread }
}
