import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Message } from '@/lib/types'

interface ChannelPagination {
  hasMore: boolean
  oldestCursor: string | null
}

export const useMessagesStore = defineStore('messages', () => {
  const messagesByChannel = ref<Record<string, Message[]>>({})
  const paginationByChannel = ref<Record<string, ChannelPagination>>({})

  return { messagesByChannel, paginationByChannel }
})
