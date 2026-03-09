<script setup lang="ts">
import UserAvatar from '@/components/user/UserAvatar.vue'
import { renderMessage } from '@/lib/mentions'
import type { Message, Profile } from '@/lib/types'

defineProps<{
  messages: (Message & { profile: Profile })[]
  canModerate: boolean
  myUsername: string | null
}>()

const emit = defineEmits<{
  close: []
  unpin: [messageId: string]
}>()

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center justify-between border-b border-bg-tertiary px-4 py-3">
      <h3 class="text-sm font-semibold">Pinned Messages</h3>
      <button @click="emit('close')" class="text-text-muted hover:text-text-primary">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="flex-1 overflow-y-auto p-3">
      <p v-if="messages.length === 0" class="py-6 text-center text-sm text-text-muted">
        No pinned messages yet.
      </p>
      <div v-else class="space-y-3">
        <div
          v-for="pm in messages"
          :key="pm.id"
          class="rounded-lg border border-bg-tertiary bg-bg-primary p-3"
        >
          <div class="mb-1 flex items-center gap-2">
            <UserAvatar :src="pm.profile.avatar_url" :alt="pm.profile.display_name" size="sm" />
            <span class="text-xs font-semibold text-text-primary">{{ pm.profile.display_name }}</span>
            <span class="ml-auto text-xs text-text-muted">{{ formatTime(pm.created_at) }}</span>
          </div>
          <p class="break-words text-xs text-text-secondary leading-relaxed" v-html="renderMessage(pm.content, myUsername)" />
          <button
            v-if="canModerate"
            @click="emit('unpin', pm.id)"
            class="mt-2 text-xs text-text-muted hover:text-danger"
          >
            Unpin
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
