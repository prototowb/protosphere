import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Server {
  id: string
  name: string
  description: string
  icon_url: string | null
  owner_id: string
  invite_code: string | null
  is_public: boolean
  member_count: number
  created_at: string
}

export const useServersStore = defineStore('servers', () => {
  const servers = ref<Server[]>([])
  const activeServerId = ref<string | null>(null)

  return { servers, activeServerId }
})
