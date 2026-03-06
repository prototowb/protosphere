import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const serverSidebarOpen = ref(true)
  const channelSidebarOpen = ref(true)
  const memberSidebarOpen = ref(true)

  function toggleChannelSidebar() { channelSidebarOpen.value = !channelSidebarOpen.value }
  function toggleMemberSidebar() { memberSidebarOpen.value = !memberSidebarOpen.value }

  return { serverSidebarOpen, channelSidebarOpen, memberSidebarOpen, toggleChannelSidebar, toggleMemberSidebar }
})
