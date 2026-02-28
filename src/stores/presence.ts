import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UserStatus } from '@/lib/types'

export const usePresenceStore = defineStore('presence', () => {
  // Live statuses received from Supabase Realtime Presence.
  // Keyed by user_id. In local mode this stays empty and is never read.
  const liveStatuses = ref<Record<string, UserStatus>>({})

  function setStatus(userId: string, status: UserStatus) {
    liveStatuses.value[userId] = status
  }

  function getStatus(userId: string, fallback: UserStatus): UserStatus {
    return liveStatuses.value[userId] ?? fallback
  }

  function clear() {
    liveStatuses.value = {}
  }

  return { liveStatuses, setStatus, getStatus, clear }
})
