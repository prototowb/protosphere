<script setup lang="ts">
const props = defineProps<{
  serverId: string
  defaultChannelId: string
  postCount: number
  canModerate: boolean
}>()

const emit = defineEmits<{
  back: []
  newPost: []
}>()
</script>

<template>
  <header class="flex h-12 items-center gap-2 border-b border-bg-tertiary bg-bg-primary px-4">
    <button
      @click="emit('back')"
      class="text-sm text-text-muted hover:text-text-primary"
    >Home</button>
    <span class="text-text-muted/50">/</span>
    <svg class="h-4 w-4 flex-shrink-0 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
    <span class="font-semibold text-text-primary">Forum</span>
    <span class="text-xs text-text-muted">{{ props.postCount }} {{ props.postCount === 1 ? 'post' : 'posts' }}</span>
    <div class="ml-auto">
      <button
        v-if="props.canModerate"
        @click="emit('newPost')"
        class="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        New post
      </button>
    </div>
  </header>
</template>
