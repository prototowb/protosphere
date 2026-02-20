import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Message } from '@/lib/types'

export const useMessagesStore = defineStore('messages', () => {
  const messagesByChannel = ref<Record<string, Message[]>>({})

  return { messagesByChannel }
})
