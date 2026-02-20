import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Channel } from '@/lib/types'

export const useChannelsStore = defineStore('channels', () => {
  const channels = ref<Channel[]>([])
  const activeChannelId = ref<string | null>(null)

  return { channels, activeChannelId }
})
