<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description?: string
  actionLabel?: string
}>()
defineEmits<{ action: [] }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 py-12 text-center">
    <div v-if="icon" class="text-4xl opacity-50">{{ icon }}</div>
    <div>
      <p class="font-semibold text-text-secondary">{{ title }}</p>
      <p v-if="description" class="mt-1 text-sm text-text-muted">{{ description }}</p>
    </div>
    <button
      v-if="actionLabel"
      @click="$emit('action')"
      class="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>
