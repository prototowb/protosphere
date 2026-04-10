<script setup lang="ts">
const props = defineProps<{
  postTitle: string | null
  editingTitle: string
  isPageType: boolean
  editingPage: boolean
  canEdit: boolean
  savingPage: boolean
  isAuthor: boolean
}>()

const emit = defineEmits<{
  goHome: []
  goForum: []
  save: []
  cancel: []
  startEdit: []
  delete: []
}>()
</script>

<template>
  <header class="flex h-12 items-center gap-2 border-b border-bg-tertiary bg-bg-primary px-4 min-w-0">
    <button @click="emit('goHome')" class="flex-shrink-0 text-sm text-text-muted hover:text-text-primary">Home</button>
    <span class="flex-shrink-0 text-text-muted/50">/</span>
    <button @click="emit('goForum')" class="flex-shrink-0 text-sm text-text-muted hover:text-text-primary">Forum</button>
    <span class="flex-shrink-0 text-text-muted/50">/</span>
    <span class="truncate text-sm font-semibold text-text-primary">
      {{ (props.editingPage && props.editingTitle) ? props.editingTitle : (props.postTitle ?? '…') }}
    </span>

    <div class="ml-auto flex flex-shrink-0 items-center gap-2">
      <template v-if="props.isPageType">
        <template v-if="props.editingPage && props.canEdit">
          <button @click="emit('save')" :disabled="props.savingPage" class="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50">
            {{ props.savingPage ? 'Saving…' : 'Save page' }}
          </button>
          <button @click="emit('cancel')" class="rounded px-3 py-1.5 text-xs text-text-muted hover:text-text-primary">Cancel</button>
        </template>
        <button v-else-if="props.canEdit" @click="emit('startEdit')" class="rounded bg-bg-tertiary px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary">
          Edit page
        </button>
      </template>
      <button
        v-if="props.isAuthor && (!props.isPageType || !props.editingPage)"
        @click="emit('delete')"
        class="flex items-center gap-1 rounded px-2 py-1 text-xs text-text-muted hover:bg-red-500/10 hover:text-red-400"
        title="Delete post"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        Delete
      </button>
    </div>
  </header>
</template>
