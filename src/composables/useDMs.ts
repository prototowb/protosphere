import { ref } from 'vue'
import { backend } from '@/lib/backend'
import { useAuthStore } from '@/stores/auth'
import { useDmsStore } from '@/stores/dms'
import type { Profile, DirectMessage } from '@/lib/types'

export function useDMs() {
  const authStore = useAuthStore()
  const store = useDmsStore()
  const loading = ref(false)

  async function fetchGroups() {
    if (!authStore.user?.id) return
    loading.value = true
    try {
      store.groups = await backend.dm.listGroups(authStore.user.id)
    } finally {
      loading.value = false
    }
  }

  async function openDM(otherUserId: string): Promise<string> {
    if (!authStore.user?.id) throw new Error('Not authenticated')
    const group = await backend.dm.getOrCreate(authStore.user.id, otherUserId)
    await fetchGroups()
    return group.id
  }

  async function fetchMessages(dmGroupId: string) {
    store.messagesByGroup[dmGroupId] = await backend.dm.listMessages(dmGroupId)
  }

  async function sendMessage(dmGroupId: string, content: string, replyToId?: string | null) {
    if (!authStore.user?.id) return
    const msg = await backend.dm.sendMessage(dmGroupId, authStore.user.id, content, replyToId)
    if (!store.messagesByGroup[dmGroupId]) store.messagesByGroup[dmGroupId] = []
    store.messagesByGroup[dmGroupId].push(msg)
    // Update last message preview in group list
    const group = store.groups.find((g) => g.id === dmGroupId)
    if (group) group.lastMessage = msg
    return msg
  }

  async function editMessage(dmGroupId: string, messageId: string, content: string) {
    const updated = await backend.dm.editMessage(messageId, content)
    const list = store.messagesByGroup[dmGroupId]
    if (list) {
      const msg = list.find((m) => m.id === messageId) as (DirectMessage & { profile: Profile }) | undefined
      if (msg) {
        msg.content = updated.content
        msg.edited_at = updated.edited_at
      }
    }
  }

  async function deleteMessage(dmGroupId: string, messageId: string) {
    await backend.dm.deleteMessage(messageId)
    const list = store.messagesByGroup[dmGroupId]
    if (list) {
      store.messagesByGroup[dmGroupId] = list.filter((m) => m.id !== messageId)
    }
  }

  async function searchUsers(query: string): Promise<Profile[]> {
    if (!authStore.user?.id || !query.trim()) return []
    return backend.profiles.search(query.trim(), authStore.user.id)
  }

  return {
    loading,
    fetchGroups,
    openDM,
    fetchMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    searchUsers,
  }
}
