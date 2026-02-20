import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useMentionsStore = defineStore('mentions', () => {
  // serverId → unread mention count
  const mentionsByServer = ref<Record<string, number>>({})

  return { mentionsByServer }
})
