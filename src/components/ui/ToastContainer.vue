<script setup lang="ts">
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()

const variantClasses: Record<string, string> = {
  success: 'border-success/40 bg-success/10 text-success',
  error: 'border-danger/40 bg-danger/10 text-danger',
  info: 'border-accent/40 bg-accent/10 text-accent',
  warning: 'border-presence-idle/40 bg-presence-idle/10 text-presence-idle',
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
      <TransitionGroup
        enter-active-class="transition-all duration-300 ease-out"
        leave-active-class="transition-all duration-200 ease-in"
        enter-from-class="translate-x-full opacity-0"
        enter-to-class="translate-x-0 opacity-100"
        leave-from-class="translate-x-0 opacity-100"
        leave-to-class="translate-x-full opacity-0"
      >
        <div
          v-for="t in toast.toasts"
          :key="t.id"
          class="flex min-w-64 max-w-sm items-center gap-2 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm"
          :class="variantClasses[t.variant]"
        >
          <span class="flex-1 text-sm font-medium">{{ t.message }}</span>
          <button
            @click="toast.dismiss(t.id)"
            class="flex-shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
