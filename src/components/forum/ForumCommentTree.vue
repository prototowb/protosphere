<script setup lang="ts">
import { ref, computed } from 'vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
import MessageInput from '@/components/chat/MessageInput.vue'
import EmojiPicker from '@/components/chat/EmojiPicker.vue'
import type { ForumComment, ForumCommentReaction, Profile } from '@/lib/types'

const props = defineProps<{
  comments: (ForumComment & { profile: Profile })[]
  parentId?: string | null
  depth?: number
  canPost: boolean
  userVotes: Record<string, 1 | -1>
  reactions: Record<string, ForumCommentReaction[]>
  currentUserId?: string | null
}>()

const emit = defineEmits<{
  reply: [parentId: string | null, content: string]
  vote: [commentId: string, value: 1 | -1]
  removeVote: [commentId: string]
  react: [commentId: string, emoji: string]
  removeReaction: [commentId: string, emoji: string]
  edit: [commentId: string, content: string]
}>()

const depth = computed(() => props.depth ?? 0)
const parentId = computed(() => props.parentId ?? null)

const children = computed(() => {
  const filtered = props.comments.filter((c) => c.parent_comment_id === parentId.value)
  if (depth.value === 0) {
    return [...filtered].sort((a, b) => b.vote_score - a.vote_score || new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }
  return filtered
})

const replyingTo = ref<string | null>(null)
const replyContent = ref('')
const replyInputEl = ref<InstanceType<typeof MessageInput> | null>(null)

// Edit state
const editingCommentId = ref<string | null>(null)
const editContent = ref('')

// Reaction picker — per-comment emoji picker
const showReactionPicker = ref<string | null>(null)
const reactionPickerAnchor = ref<{ top: number; right: number } | null>(null)

// Reply emoji picker
const replyEmojiOpen = ref(false)
const replyEmojiAnchor = ref<{ bottom: number; right: number } | null>(null)

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
  replyEmojiOpen.value = false
}

function handleVote(commentId: string, value: 1 | -1) {
  if (props.userVotes[commentId] === value) {
    emit('removeVote', commentId)
  } else {
    emit('vote', commentId, value)
  }
}

function openReactionPicker(commentId: string, event: MouseEvent) {
  if (showReactionPicker.value === commentId) {
    showReactionPicker.value = null
    reactionPickerAnchor.value = null
    return
  }
  const btn = event.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  reactionPickerAnchor.value = { top: rect.bottom + 4, right: window.innerWidth - rect.right }
  showReactionPicker.value = commentId
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
  reactionPickerAnchor.value = null
}

function openReplyEmoji(event: MouseEvent) {
  if (replyEmojiOpen.value) {
    replyEmojiOpen.value = false
    return
  }
  const btn = event.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  replyEmojiAnchor.value = { bottom: window.innerHeight - rect.top + 8, right: window.innerWidth - rect.right }
  replyEmojiOpen.value = true
}

function insertReplyEmoji(emoji: string) {
  replyInputEl.value?.insertEmoji(emoji)
  replyEmojiOpen.value = false
}

function startEdit(comment: ForumComment & { profile: Profile }) {
  editingCommentId.value = comment.id
  editContent.value = comment.content
}

function cancelEdit() {
  editingCommentId.value = null
  editContent.value = ''
}

function submitEdit(commentId: string) {
  const content = editContent.value.trim()
  if (!content) return
  emit('edit', commentId, content)
  editingCommentId.value = null
  editContent.value = ''
}

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

const depthColors = ['border-violet-500/40', 'border-sky-500/40', 'border-emerald-500/40']
</script>

<template>
  <div>
    <div
      v-for="comment in children"
      :key="comment.id"
      :class="['mb-4', depth > 0 ? `ml-8 border-l-2 pl-5 ${depthColors[(depth - 1) % depthColors.length]}` : '']"
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
          <span v-if="comment.edited_at" class="text-xs text-text-muted italic">(edited)</span>
        </div>

        <!-- Edit mode -->
        <div v-if="editingCommentId === comment.id" class="mb-2">
          <textarea
            v-model="editContent"
            rows="3"
            class="w-full resize-none rounded-lg bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none ring-1 ring-bg-tertiary focus:ring-accent"
            @keydown.ctrl.enter="submitEdit(comment.id)"
            @keydown.escape="cancelEdit"
          />
          <div class="mt-1.5 flex items-center justify-end gap-2">
            <button @click="cancelEdit" class="text-xs text-text-muted hover:text-text-primary">Cancel</button>
            <button
              @click="submitEdit(comment.id)"
              :disabled="!editContent.trim()"
              class="rounded bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>

        <!-- Content -->
        <p v-else class="mb-3 break-words text-sm text-text-secondary leading-relaxed">{{ comment.content }}</p>

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
            <button
              @click="openReactionPicker(comment.id, $event)"
              :class="['rounded-full border px-1.5 py-0.5 text-xs text-text-muted transition-colors', showReactionPicker === comment.id ? 'border-accent/50 bg-accent/10 text-accent' : 'border-bg-tertiary bg-bg-primary hover:border-accent/30 hover:text-text-primary']"
            >
              +
            </button>
          </div>

          <!-- Edit button (own comments only) -->
          <button
            v-if="canPost && comment.author_id === currentUserId && editingCommentId !== comment.id"
            @click="startEdit(comment)"
            class="text-xs text-text-muted hover:text-text-primary"
            title="Edit"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>

          <!-- Reply -->
          <button
            v-if="canPost && depth < 3"
            @click="replyingTo = replyingTo === comment.id ? null : comment.id; replyEmojiOpen = false"
            class="ml-auto text-xs text-text-muted hover:text-text-primary"
          >
            Reply
          </button>
        </div>
      </div>

      <!-- Inline reply input -->
      <div v-if="replyingTo === comment.id" class="mt-1.5 ml-4">
        <div class="rounded-lg bg-bg-tertiary overflow-hidden">
          <div class="flex items-center gap-2 px-3 py-2">
            <MessageInput
              ref="replyInputEl"
              v-model="replyContent"
              placeholder="Write a reply…"
              class="flex-1 min-w-0 text-sm"
              @submit="submitReply(comment.id)"
            />
            <!-- Emoji button -->
            <button
              type="button"
              @click="openReplyEmoji($event)"
              :class="replyEmojiOpen ? 'text-accent' : 'text-text-muted hover:text-text-primary'"
              class="flex-shrink-0 rounded p-1 transition-colors"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                <line x1="9" y1="9" x2="9.01" y2="9" stroke-linecap="round" stroke-width="2.5"/>
                <line x1="15" y1="9" x2="15.01" y2="9" stroke-linecap="round" stroke-width="2.5"/>
              </svg>
            </button>
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-bg-secondary px-3 py-1.5">
            <button @click="replyingTo = null; replyEmojiOpen = false" class="text-xs text-text-muted hover:text-text-primary">Cancel</button>
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
        @edit="(cid, content) => emit('edit', cid, content)"
      />
    </div>
  </div>

  <!-- Reaction emoji picker (full picker, teleported) -->
  <Teleport to="body">
    <div
      v-if="showReactionPicker && reactionPickerAnchor"
      class="fixed z-[9999]"
      :style="{ top: reactionPickerAnchor.top + 'px', right: reactionPickerAnchor.right + 'px' }"
      @click.stop
    >
      <EmojiPicker @select="handleReaction(showReactionPicker!, $event)" />
    </div>
    <div
      v-if="showReactionPicker"
      class="fixed inset-0 z-[9998]"
      @click="showReactionPicker = null; reactionPickerAnchor = null"
    />
    <!-- Reply emoji drawer -->
    <div
      v-if="replyEmojiOpen && replyEmojiAnchor"
      class="fixed z-[9997]"
      :style="{ bottom: replyEmojiAnchor.bottom + 'px', right: replyEmojiAnchor.right + 'px' }"
      @click.stop
    >
      <EmojiPicker @select="insertReplyEmoji($event)" />
    </div>
    <div
      v-if="replyEmojiOpen"
      class="fixed inset-0 z-[9996]"
      @click="replyEmojiOpen = false"
    />
  </Teleport>
</template>
