import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Message {
  id: string
  channel_id: string
  author_id: string
  content: string
  edited_at: string | null
  reply_to_id: string | null
  attachments: Array<{ url: string; filename: string; size: number; mime_type: string }>
  is_pinned: boolean
  created_at: string
}

export const useMessagesStore = defineStore('messages', () => {
  const messagesByChannel = ref<Record<string, Message[]>>({})

  return { messagesByChannel }
})
