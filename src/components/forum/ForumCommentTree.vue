<script setup lang="ts">
import { ref, computed } from 'vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
import type { ForumComment, ForumCommentReaction, Profile } from '@/lib/types'

const props = defineProps<{
  comments: (ForumComment & { profile: Profile })[]
  parentId?: string | null
  depth?: number
  canPost: boolean
  userVotes: Record<string, 1 | -1>          // commentId → user's vote value
  reactions: Record<string, ForumCommentReaction[]> // commentId → reactions array
  currentUserId?: string | null
}>()

const emit = defineEmits<{
  reply: [parentId: string | null, content: string]
  vote: [commentId: string, value: 1 | -1]
  removeVote: [commentId: string]
  react: [commentId: string, emoji: string]
  removeReaction: [commentId: string, emoji: string]
}>()

const depth = computed(() => props.depth ?? 0)
const parentId = computed(() => props.parentId ?? null)

// Root level: sort by vote_score DESC. Nested: sort by created_at ASC.
const children = computed(() => {
  const filtered = props.comments.filter((c) => c.parent_comment_id === parentId.value)
  if (depth.value === 0) {
    return [...filtered].sort((a, b) => b.vote_score - a.vote_score || new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }
  return filtered
})

const replyingTo = ref<string | null>(null)
const replyContent = ref('')
const showReactionPicker = ref<string | null>(null)

// Quick reaction emojis
const quickEmojis = ['👍', '❤️', '😂', '🔥', '👀', '✅']

function formatDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString())
    return `Today at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' at ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function submitReply(parentCommentId: string | null) {
  const content = replyContent.value.trim()
  if (!content) return
  emit('reply', parentCommentId, content)
  replyContent.value = ''
  replyingTo.value = null
}

function handleVote(commentId: string, value: 1 | -1) {
  if (props.userVotes[commentId] === value) {
    emit('removeVote', commentId)
  } else {
    emit('vote', commentId, value)
  }
}

function handleReaction(commentId: string, emoji: string) {
  const existing = (props.reactions[commentId] ?? []).find(
    (r) => r.user_id === props.currentUserId && r.emoji === emoji
  )
  if (existing) {
    emit('removeReaction', commentId, emoji)
  } else {
    emit('react', commentId, emoji)
  }
  showReactionPicker.value = null
}

// Group reactions by emoji with count
function groupedReactions(commentId: string) {
  const rxns = props.reactions[commentId] ?? []
  const map = new Map<string, { emoji: string; count: number; mine: boolean }>()
  for (const r of rxns) {
    const existing = map.get(r.emoji)
    if (existing) {
      existing.count++
      if (r.user_id === props.currentUserId) existing.mine = true
    } else {
      map.set(r.emoji, { emoji: r.emoji, count: 1, mine: r.user_id === props.currentUserId })
    }
  }
  return [...map.values()]
}

// Depth-based left border colors
const depthColors = ['border-violet-500/40', 'border-sky-500/40', 'border-emerald-500/40']
</script>

<template>
  <div>
    <div
      v-for="comment in children"
      :key="comment.id"
      :class="['mb-2', depth > 0 ? `ml-4 border-l-2 pl-3 ${depthColors[(depth - 1) % depthColors.length]}` : '']"
    >
      <!-- Comment card -->
      <div class="rounded-lg bg-bg-secondary px-4 py-3">
        <!-- Author row -->
        <div class="mb-2 flex items-center gap-2">
          <UserAvatar
            :src="comment.profile?.avatar_url"
            :alt="comment.profile?.display_name"
            size="xs"
            class="flex-shrink-0"
          />
          <span class="text-sm font-semibold text-text-primary">{{ comment.profile?.display_name ?? 'Unknown' }}</span>
          <span class="text-xs text-text-muted">{{ formatDate(comment.created_at) }}</span>
          <span v-if="comment.edited_at" class="text-xs text-text-muted">(edited)</span>
        </div>

        <!-- Content -->
        <p class="mb-3 break-words text-sm text-text-secondary leading-relaxed">{{ comment.content }}</p>

        <!-- Action bar -->
        <div class="flex items-center gap-3">
          <!-- Votes -->
          <div class="flex items-center gap-1">
            <button
              @click="handleVote(comment.id, 1)"
              :class="[
                'flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium transition-colors',
                userVotes[comment.id] === 1
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-text-muted hover:bg-bg-hover hover:text-emerald-400',
              ]"
            >
              <svg class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l8 8H4z"/></svg>
            </button>
            <span
              class="min-w-[1.25rem] text-center text-xs font-semibold tabular-nums"
              :class="comment.vote_score > 0 ? 'text-emerald-400' : comment.vote_score < 0 ? 'text-red-400' : 'text-text-muted'"
            >{{ comment.vote_score }}</span>
            <button
              @click="handleVote(comment.id, -1)"
              :class="[
                'flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium transition-colors',
                userVotes[comment.id] === -1
                  ? 'bg-red-500/20 text-red-400'
                  : 'text-text-muted hover:bg-bg-hover hover:text-red-400',
              ]"
            >
              <svg class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20l-8-8h16z"/></svg>
            </button>
          </div>

          <!-- Reaction strip -->
          <div class="flex flex-wrap items-center gap-1">
            <button
              v-for="r in groupedReactions(comment.id)"
              :key="r.emoji"
              @click="handleReaction(comment.id, r.emoji)"
              :class="[
                'flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs transition-colors',
                r.mine
                  ? 'border-accent/50 bg-accent/10 text-text-primary'
                  : 'border-bg-tertiary bg-bg-primary text-text-secondary hover:border-accent/30',
              ]"
            >
              {{ r.emoji }} {{ r.count }}
            </button>

            <!-- Add reaction -->
            <div class="relative">
              <button
                @click="showReactionPicker = showReactionPicker === comment.id ? null : comment.id"
                class="rounded-full border border-bg-tertiary bg-bg-primary px-1.5 py-0.5 text-xs text-text-muted hover:border-accent/30 hover:text-text-primary transition-colors"
              >
                +
              </button>
              <div
                v-if="showReactionPicker === comment.id"
                class="absolute bottom-full left-0 z-10 mb-1 flex gap-1 rounded-lg border border-bg-tertiary bg-bg-secondary p-1.5 shadow-lg"
                @mouseleave="showReactionPicker = null"
              >
                <button
                  v-for="emoji in quickEmojis"
                  :key="emoji"
                  @click="handleReaction(comment.id, emoji)"
                  class="rounded p-1 text-sm hover:bg-bg-hover"
                >{{ emoji }}</button>
              </div>
            </div>
          </div>

          <!-- Reply -->
          <button
            v-if="canPost && depth < 3"
            @click="replyingTo = replyingTo === comment.id ? null : comment.id"
            class="ml-auto text-xs text-text-muted hover:text-text-primary"
          >
            Reply
          </button>
        </div>
      </div>

      <!-- Inline reply input -->
      <div v-if="replyingTo === comment.id" class="mt-1.5 ml-4">
        <div class="rounded-lg bg-bg-primary ring-1 ring-bg-tertiary focus-within:ring-accent overflow-hidden">
          <input
            v-model="replyContent"
            type="text"
            placeholder="Write a reply…"
            autofocus
            class="w-full bg-transparent px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none"
            @keydown.enter.prevent="submitReply(comment.id)"
            @keydown.escape="replyingTo = null"
          />
          <div class="flex items-center justify-end gap-2 border-t border-bg-tertiary px-3 py-1">
            <button @click="replyingTo = null" class="text-xs text-text-muted hover:text-text-primary">Cancel</button>
            <button
              @click="submitReply(comment.id)"
              :disabled="!replyContent.trim()"
              class="rounded bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              Post
            </button>
          </div>
        </div>
      </div>

      <!-- Recursive children -->
      <ForumCommentTree
        :comments="comments"
        :parent-id="comment.id"
        :depth="depth + 1"
        :can-post="canPost"
        :user-votes="userVotes"
        :reactions="reactions"
        :current-user-id="currentUserId"
        @reply="(pid, content) => emit('reply', pid, content)"
        @vote="(cid, val) => emit('vote', cid, val)"
        @remove-vote="(cid) => emit('removeVote', cid)"
        @react="(cid, emoji) => emit('react', cid, emoji)"
        @remove-reaction="(cid, emoji) => emit('removeReaction', cid, emoji)"
      />
    </div>
  </div>
</template>
