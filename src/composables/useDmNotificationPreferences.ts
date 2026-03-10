import { ref } from 'vue'
import { backend } from '@/lib/backend'

// Module-level cache so state is shared across all instances
const muteCache = ref<Record<string, boolean>>({})

export function useDmNotificationPreferences() {
  function isMuted(groupId: string): boolean {
    return muteCache.value[groupId] ?? false
  }

  async function loadMute(userId: string, groupId: string): Promise<boolean> {
    const pref = await backend.dm_notification_preferences.get(userId, groupId)
    const muted = pref?.muted ?? false
    muteCache.value = { ...muteCache.value, [groupId]: muted }
    return muted
  }

  async function setMute(userId: string, groupId: string, muted: boolean): Promise<void> {
    await backend.dm_notification_preferences.set(userId, groupId, muted)
    muteCache.value = { ...muteCache.value, [groupId]: muted }
  }

  return { muteCache, isMuted, loadMute, setMute }
}
