import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const serverSidebarOpen = ref(true)
  const channelSidebarOpen = ref(true)
  const memberSidebarOpen = ref(true)

  return { serverSidebarOpen, channelSidebarOpen, memberSidebarOpen }
})
