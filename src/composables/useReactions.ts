import { backend } from '@/lib/backend'
import { useAuthStore } from '@/stores/auth'
import { useReactionsStore } from '@/stores/reactions'

export function useReactions() {
  const authStore = useAuthStore()
  const reactionsStore = useReactionsStore()

  async function fetchReactionsForChannel(channelId: string) {
    const all = await backend.reactions.listByChannel(channelId)
    // Group by message_id
    const grouped: Record<string, typeof all> = {}
    for (const r of all) {
      const list = grouped[r.message_id] ?? []
      list.push(r)
      grouped[r.message_id] = list
    }
    // Merge into store (replace per-message entries that belong to this channel)
    for (const msgId of Object.keys(grouped)) {
      reactionsStore.reactionsByMessage[msgId] = grouped[msgId] ?? []
    }
  }

  async function toggleReaction(messageId: string, emoji: string) {
    if (!authStore.user?.id) return
    const userId = authStore.user.id
    const existing = (reactionsStore.reactionsByMessage[messageId] ?? []).find(
      (r) => r.user_id === userId && r.emoji === emoji,
    )
    if (existing) {
      await backend.reactions.remove(messageId, userId, emoji)
      reactionsStore.reactionsByMessage[messageId] = (
        reactionsStore.reactionsByMessage[messageId] ?? []
      ).filter((r) => !(r.user_id === userId && r.emoji === emoji))
    } else {
      const reaction = await backend.reactions.add(messageId, userId, emoji)
      if (!reactionsStore.reactionsByMessage[messageId]) {
        reactionsStore.reactionsByMessage[messageId] = []
      }
      reactionsStore.reactionsByMessage[messageId].push(reaction)
    }
  }

  return { fetchReactionsForChannel, toggleReaction }
}
