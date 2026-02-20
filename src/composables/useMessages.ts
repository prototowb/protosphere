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

  async function deleteMessage(channelId: string, messageId: string) {
    await backend.messages.delete(messageId)
    const list = messagesStore.messagesByChannel[channelId]
    if (list) {
      messagesStore.messagesByChannel[channelId] = list.filter((m) => m.id !== messageId)
    }
  }

  return {
    loading,
    fetchMessages,
    sendMessage,
    editMessage,
    deleteMessage,
  }
}
