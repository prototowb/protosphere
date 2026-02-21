import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ContextMenuItem {
  label: string
  icon?: string
  danger?: boolean
  separator?: boolean
  action: () => void
}

export const useContextMenuStore = defineStore('contextMenu', () => {
  const visible = ref(false)
  const x = ref(0)
  const y = ref(0)
  const items = ref<ContextMenuItem[]>([])

  function show(event: MouseEvent, menuItems: ContextMenuItem[]) {
    event.preventDefault()
    items.value = menuItems
    // Position with viewport clamping
    const menuWidth = 200
    const menuHeight = menuItems.length * 36
    x.value = Math.min(event.clientX, window.innerWidth - menuWidth - 8)
    y.value = Math.min(event.clientY, window.innerHeight - menuHeight - 8)
    visible.value = true
  }

  function hide() {
    visible.value = false
    items.value = []
  }

  return { visible, x, y, items, show, hide }
})
