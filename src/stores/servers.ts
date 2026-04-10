import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Server } from '@/lib/types'

export const useServersStore = defineStore('servers', () => {
  const servers = ref<Server[]>([])
  const activeServerId = ref<string | null>(null)
  /** Current user's legacy role per space (server_id → role string). */
  const myRoles = ref<Record<string, string>>({})

  return { servers, activeServerId, myRoles }
})
