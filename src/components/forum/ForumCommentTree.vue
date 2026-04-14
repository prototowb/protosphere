<script setup lang="ts">
import { ref, computed } from 'vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
import MessageInput from '@/components/chat/MessageInput.vue'
import EmojiPickerPopover from '@/components/ui/EmojiPickerPopover.vue'
import EmojiIcon from '@/components/ui/EmojiIcon.vue'
import RichText from '@/components/ui/RichText.vue'
import VoteButtons from '@/components/chat/VoteButtons.vue'
import { formatDateShort } from '@/lib/formatters'
import type { ForumComment, ForumCommentReaction, Profile } from '@/lib/types'

const props = defineProps<{
  comments: (ForumComment & { profile: Profile })[]
  parentId?: string | null
  depth?: number
  compact?: boolean
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
  delete: [commentId: string]
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
function setReplyInputRef(el: unknown) { replyInputEl.value = el as InstanceType<typeof MessageInput> | null }

// Edit state
const editingCommentId = ref<string | null>(null)
const editContent = ref('')
const editInputEl = ref<InstanceType<typeof MessageInput> | null>(null)
function setEditInputRef(el: unknown) { editInputEl.value = el as InstanceType<typeof MessageInput> | null }

// Reaction picker — per-comment emoji picker
const showReactionPicker = ref<string | null>(null)
const reactionPickerAnchor = ref<{ top: number; right: number } | null>(null)

// Reply emoji picker
const replyEmojiOpen = ref(false)
const replyEmojiAnchor = ref<{ bottom: number; right: number } | null>(null)

// Edit emoji picker
const editEmojiOpen = ref(false)
const editEmojiAnchor = ref<{ bottom: number; right: number } | null>(null)


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

function openEditEmoji(event: MouseEvent) {
  if (editEmojiOpen.value) {
    editEmojiOpen.value = false
    return
  }
  const btn = event.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  editEmojiAnchor.value = { bottom: window.innerHeight - rect.top + 8, right: window.innerWidth - rect.right }
  editEmojiOpen.value = true
}

function insertEditEmoji(emoji: string) {
  editInputEl.value?.insertEmoji(emoji)
  editEmojiOpen.value = false
}

function startEdit(comment: ForumComment & { profile: Profile }) {
  editingCommentId.value = comment.id
  editContent.value = comment.content
}

function cancelEdit() {
  editingCommentId.value = null
  editContent.value = ''
  editEmojiOpen.value = false
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

defineOptions({ inheritAttrs: false })
</script>

<template>
  <div class="space-y-2" v-bind="$attrs">
    <div
      v-for="comment in children"
      :key="comment.id"
      :class="[depth > 0 ? `${props.compact ? 'ml-3 pl-2' : 'ml-8 pl-5'} border-l-2 ${depthColors[(depth - 1) % depthColors.length]}` : '']"
    >
      <!-- Comment card -->
      <div :class="['mb-1.5 rounded-lg bg-bg-secondary', props.compact ? 'px-2.5 py-2' : 'px-4 py-3']">
        <!-- Author row -->
        <div class="mb-1.5 flex gap-1.5 items-center">
          <UserAvatar :src="comment.profile?.avatar_url" :alt="comment.profile?.display_name" size="xs" class="mt-0.5 flex-shrink-0" />
          <div class="min-w-0 flex flex-1" :class="[props.compact ? 'flex-col' : '']">
            <p class="text-sm font-semibold text-text-primary leading-none mb-0.5">{{ comment.profile?.display_name ?? 'Unknown' }}</p>
            <p class="text-xs text-text-muted leading-none" :class="[props.compact ? 'ml-0' : 'ml-auto']">{{ formatDateShort(comment.created_at) }}<span v-if="comment.edited_at" class="italic"> · edited</span></p>
          </div>
          <!-- Edit / Delete buttons (own comments only, not deleted) -->
          <template v-if="canPost && comment.author_id === currentUserId && !comment.is_deleted && editingCommentId !== comment.id">
            <div class="flex flex-shrink-0 items-center gap-1">
              <button @click="startEdit(comment)" class="text-text-muted hover:text-text-primary" title="Edit">
                <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button @click="emit('delete', comment.id)" class="text-text-muted hover:text-red-400" title="Delete">
                <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>
          </template>
        </div>

        <!-- Edit mode -->
        <div v-if="editingCommentId === comment.id" class="mb-2">
          <div class="rounded-lg bg-bg-primary overflow-hidden ring-1 ring-bg-tertiary focus-within:ring-accent">
            <div class="flex items-center gap-2 px-3 py-2">
              <MessageInput
                :ref="setEditInputRef"
                v-model="editContent"
                placeholder="Edit your comment…"
                class="flex-1 min-w-0 text-sm"
                @submit="submitEdit(comment.id)"
              />
              <!-- Edit emoji button -->
              <button
                type="button"
                @click="openEditEmoji($event)"
                :class="editEmojiOpen ? 'text-accent' : 'text-text-muted hover:text-text-primary'"
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
        </div>

        <!-- Content -->
        <p v-else-if="comment.is_deleted" :class="[props.compact ? 'ml-5 mb-1.5' : 'ml-8 mb-3', 'text-xs text-text-muted italic']">This comment was deleted.</p>
        <p v-else :class="[props.compact ? 'mb-1.5' : 'ml-8 mb-3', 'break-words text-sm text-text-secondary leading-relaxed']"><RichText :text="comment.content" /></p>

        <!-- Action bar (hidden for deleted comments) -->
        <div v-if="!comment.is_deleted" :class="['flex flex-wrap items-center', props.compact ? 'gap-1.5' : 'gap-3']">
          <VoteButtons
            :score="comment.vote_score"
            :user-vote="userVotes[comment.id] ?? null"
            size="sm"
            @vote="(v: 1 | -1) => handleVote(comment.id, v)"
          />

          <!-- Reaction strip -->
          <div class="flex flex-wrap items-center gap-1">
            <button
              v-for="r in groupedReactions(comment.id)"
              :key="r.emoji"
              @click="handleReaction(comment.id, r.emoji)"
              :class="[
                'flex items-center gap-0.5 rounded border px-1 text-sm transition-colors',
                r.mine
                  ? 'border-accent/50 bg-accent/10 text-text-primary'
                  : 'border-bg-tertiary bg-bg-primary text-text-secondary hover:border-accent/30',
              ]"
            >
              <EmojiIcon :emoji="r.emoji" size="1em" /> {{ r.count }}
            </button>

            <!-- Add reaction -->
            <button
              @click="openReactionPicker(comment.id, $event)"
              :class="['rounded border px-1.5 text-sm text-text-muted transition-colors', showReactionPicker === comment.id ? 'border-accent/50 bg-accent/10 text-accent' : 'border-bg-tertiary bg-bg-primary hover:border-accent/30 hover:text-text-primary']"
            >
              +
            </button>
          </div>

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
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        leave-active-class="transition-all duration-150 ease-in"
        enter-from-class="opacity-0 -translate-y-1 scale-y-95"
        enter-to-class="opacity-100 translate-y-0 scale-y-100"
        leave-from-class="opacity-100 translate-y-0 scale-y-100"
        leave-to-class="opacity-0 -translate-y-1 scale-y-95"
      >
      <div v-if="replyingTo === comment.id" class="mt-1.5 ml-4 mb-4 origin-top">
        <div class="rounded-lg bg-bg-tertiary overflow-hidden shadow-[6px_12px_24px_-6px_#2b2a51] border-2 border-[#3c3a67]">
          <div class="flex items-center gap-2 px-3 py-2">
            <MessageInput
              :ref="setReplyInputRef"
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
      </Transition>

      <!-- Recursive children -->
      <ForumCommentTree class="mt-1.5"
        :comments="comments"
        :parent-id="comment.id"
        :depth="depth + 1"
        :compact="compact"
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
        @delete="(cid) => emit('delete', cid)"
      />
    </div>
  </div>

  <EmojiPickerPopover
    :open="!!showReactionPicker && !!reactionPickerAnchor"
    :anchor="reactionPickerAnchor"
    @select="handleReaction(showReactionPicker!, $event)"
    @close="showReactionPicker = null; reactionPickerAnchor = null"
  />
  <EmojiPickerPopover
    :open="editEmojiOpen"
    :anchor="editEmojiAnchor"
    @select="insertEditEmoji($event)"
    @close="editEmojiOpen = false"
  />
  <EmojiPickerPopover
    :open="replyEmojiOpen"
    :anchor="replyEmojiAnchor"
    @select="insertReplyEmoji($event)"
    @close="replyEmojiOpen = false"
  />
</template>
