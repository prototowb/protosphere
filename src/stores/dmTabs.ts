import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useDmTabsStore = defineStore('dmTabs', () => {
  /** Ordered list of open DM group IDs shown as tabs in the top bar. */
  const openTabs = ref<string[]>([])
  /** Group ID displayed in the split pane alongside the primary conversation. */
  const splitGroupId = ref<string | null>(null)

  function openTab(groupId: string) {
    if (!openTabs.value.includes(groupId)) {
      openTabs.value.push(groupId)
    }
  }

  function closeTab(groupId: string) {
    openTabs.value = openTabs.value.filter((id) => id !== groupId)
    if (splitGroupId.value === groupId) {
      splitGroupId.value = null
    }
  }

  function setSplit(groupId: string | null) {
    splitGroupId.value = groupId
  }

  return { openTabs, splitGroupId, openTab, closeTab, setSplit }
})
