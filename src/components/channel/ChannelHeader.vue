<script setup lang="ts">
const props = defineProps<{
  channelName: string
  channelDescription?: string
  searchOpen: boolean
  showPinnedPanel: boolean
  showPollsPanel: boolean
  showEventsPanel: boolean
}>()

const emit = defineEmits<{
  toggleSearch: []
  togglePinned: []
  togglePolls: []
  toggleEvents: []
}>()
</script>

<template>
  <header class="flex h-12 items-center gap-2 border-b border-bg-tertiary bg-bg-primary px-4">
    <span class="text-text-muted">#</span>
    <span class="font-semibold text-text-primary">{{ props.channelName }}</span>
    <template v-if="props.channelDescription">
      <span class="ml-1 text-text-muted/50">·</span>
      <span class="truncate text-sm text-text-muted" :title="props.channelDescription">{{ props.channelDescription }}</span>
    </template>
    <div class="ml-auto flex items-center gap-1">
      <button
        @click="emit('toggleSearch')"
        :class="props.searchOpen ? 'text-text-primary bg-bg-hover' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'"
        class="rounded p-1.5"
        title="Search Messages"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </button>
      <button
        @click="emit('togglePinned')"
        :class="props.showPinnedPanel ? 'text-text-primary bg-bg-hover' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'"
        class="rounded p-1.5"
        title="Pinned Messages"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
        </svg>
      </button>
      <button
        @click="emit('togglePolls')"
        :class="props.showPollsPanel ? 'text-text-primary bg-bg-hover' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'"
        class="rounded p-1.5"
        title="Polls"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      </button>
      <button
        @click="emit('toggleEvents')"
        :class="props.showEventsPanel ? 'text-text-primary bg-bg-hover' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'"
        class="rounded p-1.5"
        title="Events"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </button>
    </div>
  </header>
</template>
