<script setup lang="ts">
import { ref, computed } from 'vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
import type { ForumComment, Profile } from '@/lib/types'

const props = defineProps<{
  comments: (ForumComment & { profile: Profile })[]
  parentId?: string | null
  depth?: number
  canPost: boolean
}>()

const emit = defineEmits<{
  reply: [parentId: string | null, content: string]
}>()

const depth = computed(() => props.depth ?? 0)
const parentId = computed(() => props.parentId ?? null)

const children = computed(() =>
  props.comments.filter((c) => c.parent_comment_id === parentId.value)
)

const replyingTo = ref<string | null>(null)
const replyContent = ref('')

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return `Today at ${formatTime(iso)}`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' at ' + formatTime(iso)
}

function submitReply(parentCommentId: string | null) {
  const content = replyContent.value.trim()
  if (!content) return
  emit('reply', parentCommentId, content)
  replyContent.value = ''
  replyingTo.value = null
}
</script>

<template>
  <div>
    <div
      v-for="comment in children"
      :key="comment.id"
      class="group"
      :class="depth > 0 ? 'ml-6 border-l border-bg-tertiary pl-4' : ''"
    >
      <!-- Comment row -->
      <div class="flex gap-2.5 py-2">
        <UserAvatar
          :src="comment.profile?.avatar_url"
          :alt="comment.profile?.display_name"
          size="sm"
          class="mt-0.5 flex-shrink-0"
        />
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-2">
            <span class="text-sm font-semibold text-text-primary">{{ comment.profile?.display_name ?? 'Unknown' }}</span>
            <span class="text-xs text-text-muted">{{ formatDate(comment.created_at) }}</span>
            <span v-if="comment.edited_at" class="text-xs text-text-muted">(edited)</span>
          </div>
          <p class="mt-0.5 break-words text-sm text-text-secondary leading-relaxed">{{ comment.content }}</p>
          <button
            v-if="canPost && depth < 3"
            @click="replyingTo = replyingTo === comment.id ? null : comment.id"
            class="mt-1 text-xs text-text-muted hover:text-text-primary"
          >
            Reply
          </button>
        </div>
      </div>

      <!-- Inline reply input -->
      <div v-if="replyingTo === comment.id" class="mb-2 ml-9 flex gap-2">
        <input
          v-model="replyContent"
          type="text"
          placeholder="Write a reply…"
          autofocus
          class="flex-1 rounded bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary placeholder-text-muted outline-none focus:ring-1 focus:ring-accent"
          @keydown.enter.prevent="submitReply(comment.id)"
          @keydown.escape="replyingTo = null"
        />
        <button
          @click="submitReply(comment.id)"
          :disabled="!replyContent.trim()"
          class="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          Post
        </button>
      </div>

      <!-- Recursive children -->
      <ForumCommentTree
        :comments="comments"
        :parent-id="comment.id"
        :depth="depth + 1"
        :can-post="canPost"
        @reply="(pid, content) => emit('reply', pid, content)"
      />
    </div>
  </div>
</template>
