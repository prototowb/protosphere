import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Server } from '@/lib/types'

export const useServersStore = defineStore('servers', () => {
  const servers = ref<Server[]>([])
  const activeServerId = ref<string | null>(null)

  return { servers, activeServerId }
})
