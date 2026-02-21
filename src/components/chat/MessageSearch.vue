<script setup lang="ts">
import UserAvatar from '@/components/user/UserAvatar.vue'
import type { Profile } from '@/lib/types'

interface SearchableMessage {
  id: string
  content: string
  created_at: string
  profile: Profile
}

defineProps<{
  query: string
  results: SearchableMessage[]
}>()

const emit = defineEmits<{
  'update:query': [value: string]
  close: []
  select: [messageId: string]
}>()

function highlightMatch(text: string, q: string): string {
  if (!q.trim()) return escapeHtml(text)
  const escaped = escapeHtml(text)
  const escapedQ = escapeHtml(q)
  const regex = new RegExp(`(${escapedQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return escaped.replace(regex, '<mark class="bg-accent/30 text-text-primary rounded px-0.5">$1</mark>')
}

function escapeHtml(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center justify-between border-b border-bg-tertiary px-4 py-3">
      <h3 class="text-sm font-semibold">Search Messages</h3>
      <button @click="emit('close')" class="text-text-muted hover:text-text-primary">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="px-3 py-2">
      <input
        :value="query"
        @input="emit('update:query', ($event.target as HTMLInputElement).value)"
        type="text"
        placeholder="Search…"
        class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
        autofocus
      />
    </div>
    <div class="flex-1 overflow-y-auto p-3">
      <p v-if="query && results.length === 0" class="py-4 text-center text-sm text-text-muted">
        No messages found.
      </p>
      <p v-else-if="!query" class="py-4 text-center text-sm text-text-muted">
        Type to search messages.
      </p>
      <div v-else class="space-y-2">
        <button
          v-for="msg in results"
          :key="msg.id"
          @click="emit('select', msg.id)"
          class="w-full rounded-lg border border-bg-tertiary bg-bg-primary p-3 text-left hover:border-accent/30"
        >
          <div class="mb-1 flex items-center gap-2">
            <UserAvatar :src="msg.profile.avatar_url" :alt="msg.profile.display_name" size="sm" />
            <span class="text-xs font-semibold text-text-primary">{{ msg.profile.display_name }}</span>
            <span class="ml-auto text-xs text-text-muted">{{ formatTime(msg.created_at) }}</span>
          </div>
          <p class="break-words text-xs text-text-secondary leading-relaxed" v-html="highlightMatch(msg.content, query)" />
        </button>
      </div>
    </div>
  </div>
</template>
