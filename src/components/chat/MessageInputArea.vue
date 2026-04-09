<script setup lang="ts">
import { ref } from 'vue'
import ReplyBar from '@/components/chat/ReplyBar.vue'
import MessageInput from '@/components/chat/MessageInput.vue'
import EmojiPickerPopover from '@/components/ui/EmojiPickerPopover.vue'
import type { Attachment } from '@/lib/types'

withDefaults(defineProps<{
  modelValue: string
  replyDisplayName?: string | null
  replyContent?: string | null
  typingUsers?: string[]
  pendingAttachments?: Attachment[]
  uploadingFiles?: boolean
  disabled?: boolean
  placeholder?: string
  canPost?: boolean
  showAttachButton?: boolean
  showPollButton?: boolean
  slowmodeRemaining?: number
  sending?: boolean
}>(), {
  typingUsers: () => [],
  pendingAttachments: () => [],
  uploadingFiles: false,
  disabled: false,
  placeholder: 'Message',
  canPost: true,
  showAttachButton: true,
  showPollButton: false,
  slowmodeRemaining: 0,
  sending: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: []
  input: []
  cancelReply: []
  attachFiles: [files: File[] | FileList]
  removePendingAttachment: [index: number]
  createPoll: []
}>()

const messageInputRef = ref<InstanceType<typeof MessageInput> | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

// Emoji drawer (self-contained)
const emojiDrawerOpen = ref(false)
const emojiDrawerAnchor = ref<{ bottom: number; right: number } | null>(null)

function openEmojiDrawer(event: MouseEvent) {
  if (emojiDrawerOpen.value) {
    emojiDrawerOpen.value = false
    return
  }
  const btn = event.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  emojiDrawerAnchor.value = { bottom: window.innerHeight - rect.top + 8, right: window.innerWidth - rect.right }
  emojiDrawerOpen.value = true
}

function insertEmoji(emoji: string) {
  messageInputRef.value?.insertEmoji(emoji)
}

function onFileChange(event: Event) {
  const files = (event.target as HTMLInputElement).files
  if (files?.length) {
    emit('attachFiles', files)
  }
  if (fileInputRef.value) fileInputRef.value.value = ''
}

defineExpose({ insertEmoji, focus: () => messageInputRef.value?.focus() })
</script>

<template>
  <div class="px-4 pb-4">
    <ReplyBar
      v-if="replyDisplayName"
      :display-name="replyDisplayName"
      :content-preview="replyContent ?? ''"
      @cancel="emit('cancelReply')"
    />
    <!-- Typing indicator -->
    <div v-if="typingUsers.length > 0" class="px-1 pb-1 text-xs text-text-muted">
      <span class="font-medium text-text-secondary">{{ typingUsers.join(', ') }}</span>
      {{ typingUsers.length === 1 ? 'is' : 'are' }} typing
      <span class="animate-pulse">...</span>
    </div>
    <!-- Pending attachments preview -->
    <div v-if="pendingAttachments.length > 0" class="mx-2 mb-1 flex flex-wrap gap-2 rounded-lg bg-bg-tertiary px-3 py-2">
      <div
        v-for="(att, idx) in pendingAttachments"
        :key="idx"
        class="flex items-center gap-1.5 rounded border border-bg-tertiary bg-bg-secondary px-2 py-1 text-xs"
      >
        <span class="max-w-[10rem] truncate text-text-secondary">{{ att.filename }}</span>
        <button type="button" @click="emit('removePendingAttachment', idx)" class="text-text-muted hover:text-danger">
          <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <span v-if="uploadingFiles" class="text-xs text-text-muted animate-pulse">Uploading…</span>
    </div>

    <form @submit.prevent="emit('submit')" class="flex items-center gap-2 rounded-lg bg-bg-tertiary px-4 py-3" :class="replyDisplayName ? 'rounded-t-none' : ''">
      <!-- Hidden file input -->
      <input
        ref="fileInputRef"
        type="file"
        accept="*/*"
        multiple
        class="hidden"
        @change="onFileChange"
      />
      <!-- Attachment button -->
      <button
        v-if="showAttachButton && canPost"
        type="button"
        @click="fileInputRef?.click()"
        :class="uploadingFiles ? 'text-accent animate-pulse' : 'text-text-muted hover:text-text-primary'"
        class="flex-shrink-0 rounded p-1 transition-colors"
        title="Attach File"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
        </svg>
      </button>
      <!-- Poll button -->
      <button
        v-if="showPollButton && canPost"
        type="button"
        @click="emit('createPoll')"
        class="flex-shrink-0 rounded p-1 transition-colors text-text-muted hover:text-text-primary"
        title="Create Poll"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      </button>
      <MessageInput
        ref="messageInputRef"
        :model-value="modelValue"
        :disabled="disabled || slowmodeRemaining > 0 || !canPost"
        :placeholder="placeholder"
        @update:model-value="emit('update:modelValue', $event)"
        @submit="emit('submit')"
        @input="emit('input')"
        @files="emit('attachFiles', $event)"
      />
      <!-- Emoji drawer button -->
      <button
        type="button"
        @click="openEmojiDrawer($event)"
        :class="emojiDrawerOpen ? 'text-accent' : 'text-text-muted hover:text-text-primary'"
        class="flex-shrink-0 rounded p-1 transition-colors"
        title="Emoji"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
          <circle cx="12" cy="12" r="10"/>
          <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
          <line x1="9" y1="9" x2="9.01" y2="9" stroke-linecap="round" stroke-width="2.5"/>
          <line x1="15" y1="9" x2="15.01" y2="9" stroke-linecap="round" stroke-width="2.5"/>
        </svg>
      </button>
      <button
        type="submit"
        :disabled="(!modelValue.trim() && pendingAttachments.length === 0) || sending || uploadingFiles || disabled || slowmodeRemaining > 0"
        class="min-w-8 rounded p-1 text-text-muted transition-colors hover:text-text-primary disabled:opacity-30"
      >
        <span v-if="slowmodeRemaining > 0" class="text-xs font-medium tabular-nums text-text-muted">{{ slowmodeRemaining }}s</span>
        <svg v-else class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
      </button>
    </form>

    <EmojiPickerPopover
      :open="emojiDrawerOpen"
      :anchor="emojiDrawerAnchor ?? { bottom: 80, right: 16 }"
      @select="insertEmoji"
      @close="emojiDrawerOpen = false"
    />
  </div>
</template>
