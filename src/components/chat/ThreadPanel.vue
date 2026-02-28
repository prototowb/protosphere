<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useMessagesStore } from '@/stores/messages'
import { useMessages } from '@/composables/useMessages'
import { useRealtime } from '@/composables/useRealtime'
import { useAuthStore } from '@/stores/auth'
import UserAvatar from '@/components/user/UserAvatar.vue'
import type { Channel, Profile, Message } from '@/lib/types'

const props = defineProps<{ thread: Channel; canPost: boolean }>()
const emit = defineEmits<{ close: [] }>()

const authStore = useAuthStore()
const messagesStore = useMessagesStore()
const { fetchMessages, sendMessage } = useMessages()
const { startMessages, stopMessages } = useRealtime()

const input = ref('')
const sending = ref(false)

const messages = computed(() =>
  (messagesStore.messagesByChannel[props.thread.id] ?? []) as (Message & { profile: Profile })[]
)

watch(() => props.thread.id, async (id) => {
  await fetchMessages(id)
  startMessages(id)
}, { immediate: true })

onUnmounted(() => {
  stopMessages()
})

async function submit() {
  const content = input.value.trim()
  if (!content || sending.value || !authStore.user?.id) return
  sending.value = true
  try {
    await sendMessage(props.thread.id, authStore.user.id, content)
    input.value = ''
  } finally {
    sending.value = false
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-bg-tertiary px-4 py-3">
      <div class="min-w-0">
        <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Thread</p>
        <h3 class="truncate text-sm font-semibold text-text-primary">{{ thread.name }}</h3>
      </div>
      <button @click="emit('close')" class="ml-2 flex-shrink-0 rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <!-- Messages -->
    <div class="flex-1 overflow-y-auto px-3 py-3 space-y-2">
      <p v-if="messages.length === 0" class="text-center text-xs text-text-muted py-4">No messages yet.</p>
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="flex gap-2"
      >
        <UserAvatar :src="msg.profile.avatar_url" :alt="msg.profile.display_name" size="sm" class="flex-shrink-0 mt-0.5" />
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-1.5">
            <span class="text-xs font-semibold text-text-primary">{{ msg.profile.display_name }}</span>
            <span class="text-xs text-text-muted">{{ formatTime(msg.created_at) }}</span>
          </div>
          <p class="break-words text-xs text-text-secondary leading-relaxed">{{ msg.content }}</p>
        </div>
      </div>
    </div>

    <!-- Input -->
    <div v-if="canPost" class="border-t border-bg-tertiary px-3 py-2">
      <form @submit.prevent="submit" class="flex gap-2">
        <input
          v-model="input"
          type="text"
          :placeholder="`Reply in ${thread.name}…`"
          :disabled="sending"
          class="flex-1 rounded bg-bg-tertiary px-3 py-2 text-xs text-text-primary placeholder-text-muted outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
          @keydown.enter.prevent="submit"
        />
        <button
          type="submit"
          :disabled="!input.trim() || sending"
          class="rounded bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
    <div v-else class="border-t border-bg-tertiary px-3 py-2 text-center text-xs text-text-muted">
      You cannot reply to this thread.
    </div>
  </div>
</template>
