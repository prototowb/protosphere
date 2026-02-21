import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
}

let nextId = 0

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])

  function show(message: string, variant: ToastVariant = 'info', duration?: number) {
    const id = String(++nextId)
    toasts.value.push({ id, message, variant })
    // Keep max 5 visible
    if (toasts.value.length > 5) {
      toasts.value.shift()
    }
    const ms = duration ?? (variant === 'error' ? 6000 : 4000)
    setTimeout(() => dismiss(id), ms)
  }

  function dismiss(id: string) {
    const idx = toasts.value.findIndex((t) => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }

  return { toasts, show, dismiss }
})
