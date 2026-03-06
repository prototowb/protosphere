import { ref } from 'vue'
import type { Channel } from '@/lib/types'

export type SidebarPanel = 'thread' | 'polls' | 'events' | 'pinned' | 'search' | null

export function useSidebarPanel() {
  const activePanel = ref<SidebarPanel>(null)
  const activeThread = ref<Channel | null>(null)

  function openPanel(panel: Exclude<SidebarPanel, 'thread' | null>) {
    if (activePanel.value === panel) {
      activePanel.value = null
    } else {
      activePanel.value = panel
      activeThread.value = null
    }
  }

  function openThread(thread: Channel) {
    activeThread.value = thread
    activePanel.value = 'thread'
  }

  function closePanel() {
    activePanel.value = null
    activeThread.value = null
  }

  function closeOnChannelChange() {
    if (activePanel.value !== 'thread') {
      activePanel.value = null
    }
    activeThread.value = null
  }

  const showPinnedPanel = { get value() { return activePanel.value === 'pinned' } }
  const showPollsPanel = { get value() { return activePanel.value === 'polls' } }
  const showEventsPanel = { get value() { return activePanel.value === 'events' } }

  return {
    activePanel,
    activeThread,
    showPinnedPanel,
    showPollsPanel,
    showEventsPanel,
    openPanel,
    openThread,
    closePanel,
    closeOnChannelChange,
  }
}
