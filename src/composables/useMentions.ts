import { useAuthStore } from '@/stores/auth'
import { useMessagesStore } from '@/stores/messages'
import { useMentionsStore } from '@/stores/mentions'
import { backend } from '@/lib/backend'
import { extractMentionedUsernames } from '@/lib/mentions'
import type { Message, Profile } from '@/lib/types'

const READ_STATE_KEY = 'protosphere_read_state'

// Module-level cache so multiple composable instances share one fetch
let cachedUsername: string | null = null

function getLastRead(userId: string, channelId: string): string | null {
  try {
    const state = JSON.parse(localStorage.getItem(READ_STATE_KEY) ?? '{}')
    return state[userId]?.[channelId] ?? null
  } catch {
    return null
  }
}

export function useMentions() {
  const authStore = useAuthStore()
  const messagesStore = useMessagesStore()
  const mentionsStore = useMentionsStore()

  async function loadUsername(): Promise<string | null> {
    if (cachedUsername) return cachedUsername
    if (!authStore.user?.id) return null
    try {
      const profile = await backend.profiles.get(authStore.user.id)
      cachedUsername = profile.username
      return cachedUsername
    } catch {
      return null
    }
  }

  // Call after messages are fetched for a channel
  async function scanForMentions(serverId: string, channelId: string) {
    const username = await loadUsername()
    if (!username || !authStore.user?.id) return

    const lastRead = getLastRead(authStore.user.id, channelId)
    const messages = (messagesStore.messagesByChannel[channelId] ?? []) as (Message & { profile: Profile })[]

    let count = 0
    for (const msg of messages) {
      if (msg.author_id === authStore.user.id) continue
      if (lastRead && msg.created_at <= lastRead) continue

      const isMention = extractMentionedUsernames(msg.content).includes(username)
      // Count reply-to-self as a mention
      const isReplyToMe = msg.reply_to_id
        ? messages.find((m) => m.id === msg.reply_to_id)?.author_id === authStore.user.id
        : false

      if (isMention || isReplyToMe) {
        count++
        maybeNotify(msg.profile.display_name, msg.content)
      }
    }

    if (count > 0) {
      mentionsStore.mentionsByServer[serverId] =
        (mentionsStore.mentionsByServer[serverId] ?? 0) + count
    }
  }

  // Call when user opens a server (navigates to it)
  function clearServerMentions(serverId: string) {
    delete mentionsStore.mentionsByServer[serverId]
  }

  async function requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    const result = await Notification.requestPermission()
    return result === 'granted'
  }

  function maybeNotify(senderName: string, content: string) {
    if (document.hasFocus()) return
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const preview = content.length > 100 ? content.slice(0, 100) + '…' : content
    new Notification(`${senderName} mentioned you`, {
      body: preview,
      icon: '/vite.svg',
    })
  }

  // Expose so ServerPage can get currentUsername for rendering
  async function getUsername(): Promise<string | null> {
    return loadUsername()
  }

  return { scanForMentions, clearServerMentions, requestPermission, getUsername }
}
