<script setup lang="ts">
import UserAvatar from '@/components/user/UserAvatar.vue'
import MessageAttachments from '@/components/messages/MessageAttachments.vue'
import EmojiIcon from '@/components/ui/EmojiIcon.vue'
import { formatTime, isExpiringSoon } from '@/lib/formatters'
import type { Attachment } from '@/lib/types'

export interface MessageBubbleData {
  id: string
  author_id: string
  created_at: string
  edited_at: string | null
  expires_at: string | null
  reply_to_id: string | null
  is_pinned?: boolean
  forum_post_id?: string | null
  attachments?: Attachment[]
  profile: { display_name: string; avatar_url: string | null }
  showHeader: boolean
  dateSeparator: string | null
}

const props = withDefaults(defineProps<{
  message: MessageBubbleData
  contentHtml: string
  replyAuthorName?: string | null
  replyContent?: string | null
  reactionGroups?: { emoji: string; count: number; iMine: boolean }[]
  isEditing?: boolean
  editContent?: string
  isAuthor: boolean
  canModerate?: boolean
  showReactionButton?: boolean
  showPinButton?: boolean
  serverId?: string | null
}>(), {
  reactionGroups: () => [],
  isEditing: false,
  editContent: '',
  canModerate: false,
  showReactionButton: true,
  showPinButton: false,
})

const emit = defineEmits<{
  reply: []
  startEdit: []
  delete: []
  cancelEdit: []
  submitEdit: []
  'update:editContent': [value: string]
  pin: []
  unpin: []
  toggleReaction: [emoji: string]
  openReactionPicker: [event: MouseEvent]
  contextmenu: [event: MouseEvent]
}>()

function onEditInput(event: Event) {
  emit('update:editContent', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <!-- Date separator -->
  <div v-if="message.dateSeparator" class="my-4 flex items-center gap-3">
    <div class="h-px flex-1 bg-bg-tertiary" />
    <span class="text-xs text-text-muted">{{ message.dateSeparator }}</span>
    <div class="h-px flex-1 bg-bg-tertiary" />
  </div>

  <!-- Message row -->
  <div
    :data-message-id="message.id"
    class="group relative flex gap-3 rounded px-2 py-0.5 transition-colors hover:bg-bg-secondary"
    :class="message.showHeader ? 'mt-3' : ''"
    @contextmenu.prevent="emit('contextmenu', $event)"
  >
    <!-- Avatar (only on first in group) -->
    <div class="w-10 flex-shrink-0">
      <UserAvatar
        v-if="message.showHeader"
        :src="message.profile.avatar_url"
        :alt="message.profile.display_name"
        size="sm"
      />
    </div>

    <div class="min-w-0 flex-1">
      <!-- Reply quote -->
      <div
        v-if="message.reply_to_id && replyAuthorName != null"
        class="mb-1 flex cursor-default items-center gap-1.5 text-xs text-text-muted"
      >
        <svg class="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
        </svg>
        <span class="font-medium text-text-secondary">{{ replyAuthorName }}</span>
        <span class="truncate">{{ replyContent ?? '[deleted]' }}</span>
      </div>

      <!-- Header (only on first in group) -->
      <div v-if="message.showHeader" class="mb-0.5 flex items-baseline gap-2">
        <span class="font-semibold text-text-primary">{{ message.profile.display_name }}</span>
        <span class="text-xs text-text-muted">{{ formatTime(message.created_at) }}</span>
        <span
          v-if="isExpiringSoon(message.expires_at)"
          class="h-1.5 w-1.5 rounded-full bg-amber-400"
          title="This message expires soon"
        />
      </div>

      <!-- Edit mode -->
      <div v-if="isEditing" class="flex gap-2">
        <input
          :value="editContent"
          @input="onEditInput"
          @keydown.enter.prevent="emit('submitEdit')"
          @keydown.escape="emit('cancelEdit')"
          class="flex-1 rounded border border-accent bg-bg-primary px-2 py-1 text-sm text-text-primary outline-none"
          autofocus
        />
        <button @click="emit('submitEdit')" class="rounded bg-accent px-2 py-1 text-xs text-white">Save</button>
        <button @click="emit('cancelEdit')" class="rounded px-2 py-1 text-xs text-text-muted hover:text-text-primary">Cancel</button>
      </div>

      <!-- Content -->
      <p
        v-else
        class="break-words text-sm text-text-primary leading-relaxed"
        v-html="contentHtml"
      />

      <!-- Attachments -->
      <MessageAttachments v-if="message.attachments?.length" :attachments="message.attachments" />

      <!-- Reaction pills -->
      <div
        v-if="reactionGroups.length > 0"
        class="mt-1 flex flex-wrap gap-1"
      >
        <button
          v-for="group in reactionGroups"
          :key="group.emoji"
          @click="emit('toggleReaction', group.emoji)"
          class="flex items-center gap-1 rounded border px-2 py-0.5 text-xs transition-colors"
          :class="group.iMine
            ? 'border-accent bg-accent/20 text-accent'
            : 'border-bg-tertiary bg-bg-secondary text-text-secondary hover:border-accent/50'"
        >
          <EmojiIcon :emoji="group.emoji" size="1em" />
          <span>{{ group.count }}</span>
        </button>
      </div>

      <!-- Forum post link -->
      <router-link
        v-if="message.forum_post_id && serverId"
        :to="`/spaces/${serverId}/forum/${message.forum_post_id}`"
        class="mt-1 inline-flex items-center gap-1.5 text-xs text-violet-400 hover:underline"
      >
        <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Forum post
      </router-link>
    </div>

    <!-- Hover actions -->
    <div
      v-if="!isEditing"
      class="absolute right-2 top-0 hidden -translate-y-1/2 items-center gap-1 rounded border border-bg-tertiary bg-bg-primary p-0.5 shadow group-hover:flex"
    >
      <!-- Emoji picker trigger -->
      <button
        v-if="showReactionButton"
        @click.stop="emit('openReactionPicker', $event)"
        class="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary"
        title="Add Reaction"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
        </svg>
      </button>
      <button
        @click="emit('reply')"
        class="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary"
        title="Reply"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
        </svg>
      </button>
      <!-- Pin/unpin (moderator+) -->
      <button
        v-if="showPinButton && canModerate"
        @click="message.is_pinned ? emit('unpin') : emit('pin')"
        class="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary"
        :title="message.is_pinned ? 'Unpin' : 'Pin'"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" :class="message.is_pinned ? 'text-accent' : ''">
          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
        </svg>
      </button>
      <button
        v-if="isAuthor"
        @click="emit('startEdit')"
        class="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary"
        title="Edit"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button
        v-if="isAuthor || canModerate"
        @click="emit('delete')"
        class="rounded p-1 text-text-muted hover:bg-danger/10 hover:text-danger"
        title="Delete"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>

    <!-- Timestamp on hover (for collapsed messages) -->
    <span
      v-if="!message.showHeader && !isEditing"
      class="absolute left-2 hidden text-xs text-text-muted group-hover:block"
      style="top: 50%; transform: translateY(-50%)"
    >
      {{ formatTime(message.created_at) }}
    </span>
  </div>
</template>
