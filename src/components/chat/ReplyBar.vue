<script setup lang="ts">
defineProps<{
  displayName: string
  contentPreview: string
}>()

const emit = defineEmits<{ cancel: [] }>()
</script>

<template>
  <div class="mb-1 flex items-center gap-2 rounded-t-lg bg-bg-secondary px-4 py-2 text-xs text-text-muted">
    <svg class="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
    </svg>
    <span>Replying to <span class="font-medium text-text-primary">{{ displayName }}</span></span>
    <span class="flex-1 truncate text-text-muted">{{ contentPreview }}</span>
    <button @click="emit('cancel')" class="ml-auto flex-shrink-0 hover:text-text-primary">&#10005;</button>
  </div>
</template>
