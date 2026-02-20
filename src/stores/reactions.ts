import { reactive } from 'vue'
import { defineStore } from 'pinia'
import type { Reaction } from '@/lib/types'

export const useReactionsStore = defineStore('reactions', () => {
  // keyed by message_id → array of reactions
  const reactionsByMessage = reactive<Record<string, Reaction[]>>({})

  return { reactionsByMessage }
})
