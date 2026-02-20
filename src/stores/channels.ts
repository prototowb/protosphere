import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Channel {
  id: string
  server_id: string
  name: string
  description: string
  type: string
  position: number
  is_default: boolean
  slowmode_seconds: number
  created_at: string
}

export const useChannelsStore = defineStore('channels', () => {
  const channels = ref<Channel[]>([])
  const activeChannelId = ref<string | null>(null)

  return { channels, activeChannelId }
})
