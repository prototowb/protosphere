import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Mute } from '@/lib/types'

export const useMutesStore = defineStore('mutes', () => {
  const mutesByServer = ref<Record<string, Mute[]>>({})

  function setMutes(serverId: string, mutes: Mute[]) {
    mutesByServer.value[serverId] = mutes
  }

  function addMute(mute: Mute) {
    const list = mutesByServer.value[mute.server_id] ?? []
    const idx = list.findIndex((m) => m.user_id === mute.user_id)
    if (idx !== -1) list[idx] = mute
    else list.push(mute)
    mutesByServer.value[mute.server_id] = list
  }

  function removeMute(serverId: string, userId: string) {
    const list = mutesByServer.value[serverId] ?? []
    mutesByServer.value[serverId] = list.filter((m) => m.user_id !== userId)
  }

  function isMuted(serverId: string, userId: string): boolean {
    const list = mutesByServer.value[serverId] ?? []
    const mute = list.find((m) => m.user_id === userId)
    if (!mute) return false
    if (mute.expires_at && new Date(mute.expires_at) <= new Date()) return false
    return true
  }

  return { mutesByServer, setMutes, addMute, removeMute, isMuted }
})
