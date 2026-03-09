import { ref } from 'vue'
import { backend } from '@/lib/backend'
import type { NotificationLevel } from '@/lib/types'

const levelCache = ref<Record<string, NotificationLevel>>({})

export function useNotificationPreferences() {
  function getCached(channelId: string): NotificationLevel {
    return levelCache.value[channelId] ?? 'all'
  }

  async function loadLevel(userId: string, channelId: string): Promise<NotificationLevel> {
    if (levelCache.value[channelId] !== undefined) return levelCache.value[channelId]
    const pref = await backend.notification_preferences.get(userId, channelId)
    levelCache.value[channelId] = pref?.level ?? 'all'
    return levelCache.value[channelId]
  }

  async function setLevel(userId: string, channelId: string, level: NotificationLevel) {
    await backend.notification_preferences.set(userId, channelId, level)
    levelCache.value[channelId] = level
  }

  return { levelCache, getCached, loadLevel, setLevel }
}
