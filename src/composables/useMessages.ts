import { ref } from 'vue'
import { backend } from '@/lib/backend'
import { useMessagesStore } from '@/stores/messages'
import type { Message, Profile } from '@/lib/types'

export function useMessages() {
  const messagesStore = useMessagesStore()
  const loading = ref(false)

  async function fetchMessages(channelId: string) {
    loading.value = true
    try {
      messagesStore.messagesByChannel[channelId] = await backend.messages.list(channelId)
    } finally {
      loading.value = false
    }
  }

  async function sendMessage(channelId: string, authorId: string, content: string, replyToId?: string | null) {
    const msg = await backend.messages.send(channelId, authorId, content, replyToId)
    if (!messagesStore.messagesByChannel[channelId]) {
      messagesStore.messagesByChannel[channelId] = []
    }
    messagesStore.messagesByChannel[channelId].push(msg)
    return msg
  }

  async function editMessage(channelId: string, messageId: string, content: string) {
    const updated = await backend.messages.edit(messageId, content)
    const list = messagesStore.messagesByChannel[channelId]
    if (list) {
      const idx = list.findIndex((m) => m.id === messageId)
      if (idx !== -1) {
        const existing = list[idx] as Message & { profile: Profile }
        list[idx] = { ...existing, content: updated.content, edited_at: updated.edited_at }
      }
    }
  }

  async function deleteMessage(channelId: string, messageId: string, serverId?: string, actorId?: string) {
    await backend.messages.delete(messageId)
    const list = messagesStore.messagesByChannel[channelId]
    if (list) {
      messagesStore.messagesByChannel[channelId] = list.filter((m) => m.id !== messageId)
    }
    if (serverId && actorId) {
      backend.audit_log.log(serverId, actorId, 'message.delete', 'message', messageId, { channel_id: channelId }).catch(() => {})
    }
  }

  async function pinMessage(channelId: string, messageId: string, serverId?: string, actorId?: string) {
    const updated = await backend.messages.pin(messageId)
    const list = messagesStore.messagesByChannel[channelId]
    if (list) {
      const idx = list.findIndex((m) => m.id === messageId)
      if (idx !== -1) {
        const existing = list[idx] as Message & { profile: Profile }
        list[idx] = { ...existing, is_pinned: updated.is_pinned }
      }
    }
    if (serverId && actorId) {
      backend.audit_log.log(serverId, actorId, 'message.pin', 'message', messageId, { channel_id: channelId }).catch(() => {})
    }
  }

  async function unpinMessage(channelId: string, messageId: string, serverId?: string, actorId?: string) {
    const updated = await backend.messages.unpin(messageId)
    const list = messagesStore.messagesByChannel[channelId]
    if (list) {
      const idx = list.findIndex((m) => m.id === messageId)
      if (idx !== -1) {
        const existing = list[idx] as Message & { profile: Profile }
        list[idx] = { ...existing, is_pinned: updated.is_pinned }
      }
    }
    if (serverId && actorId) {
      backend.audit_log.log(serverId, actorId, 'message.unpin', 'message', messageId, { channel_id: channelId }).catch(() => {})
    }
  }

  async function fetchPinnedMessages(channelId: string) {
    return backend.messages.listPinned(channelId)
  }

  return {
    loading,
    fetchMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    pinMessage,
    unpinMessage,
    fetchPinnedMessages,
  }
}
