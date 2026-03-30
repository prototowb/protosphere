<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { backend } from '@/lib/backend'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import ForumCommentTree from '@/components/forum/ForumCommentTree.vue'
import MessageInput from '@/components/chat/MessageInput.vue'
import EmojiPicker from '@/components/chat/EmojiPicker.vue'
import type { ForumComment, ForumCommentReaction, Profile } from '@/lib/types'

const props = defineProps<{ postId: string }>()

const authStore = useAuthStore()
const toastStore = useToastStore()

const loading = ref(true)
const comments = ref<(ForumComment & { profile: Profile })[]>([])
const commentVoteMap = ref<Record<string, 1 | -1>>({})
const reactionMap = ref<Record<string, ForumCommentReaction[]>>({})

const newComment = ref('')
const posting = ref(false)
const commentInputEl = ref<InstanceType<typeof MessageInput> | null>(null)
const emojiDrawerOpen = ref(false)
const emojiDrawerAnchor = ref<{ bottom: number; right: number } | null>(null)

async function loadComments() {
  loading.value = true
  comments.value = []
  commentVoteMap.value = {}
  reactionMap.value = {}
  try {
    const uid = authStore.user?.id
    const [commentData, commentVotes, reactions] = await Promise.all([
      backend.forum.listComments(props.postId),
      uid ? backend.forum.getUserCommentVotes(props.postId, uid) : [],
      backend.forum.listCommentReactions(props.postId),
    ])
    comments.value = commentData

    const voteObj: Record<string, 1 | -1> = {}
    for (const v of commentVotes) voteObj[v.comment_id] = v.value
    commentVoteMap.value = voteObj

    const rxnObj: Record<string, ForumCommentReaction[]> = {}
    for (const r of reactions) {
      if (!rxnObj[r.comment_id]) rxnObj[r.comment_id] = []
      rxnObj[r.comment_id]!.push(r)
    }
    reactionMap.value = rxnObj
  } catch {
    toastStore.show('Failed to load comments', 'error')
  } finally {
    loading.value = false
  }
}

onMounted(loadComments)
watch(() => props.postId, loadComments)

async function submitComment() {
  const content = newComment.value.trim()
  if (!content || posting.value || !authStore.user?.id) return
  posting.value = true
  try {
    const comment = await backend.forum.addComment(props.postId, authStore.user.id, content, null)
    comments.value.push(comment)
    commentVoteMap.value = { ...commentVoteMap.value, [comment.id]: 1 }
    newComment.value = ''
  } catch {
    toastStore.show('Failed to post comment', 'error')
  } finally {
    posting.value = false
  }
}

async function handleReply(parentId: string | null, content: string) {
  if (!authStore.user?.id) return
  try {
    const comment = await backend.forum.addComment(props.postId, authStore.user.id, content, parentId)
    comments.value.push(comment)
    commentVoteMap.value = { ...commentVoteMap.value, [comment.id]: 1 }
  } catch {
    toastStore.show('Failed to post comment', 'error')
  }
}

async function handleCommentVote(commentId: string, value: 1 | -1) {
  if (!authStore.user?.id) return
  const prev = commentVoteMap.value[commentId] ?? 0
  const comment = comments.value.find((c) => c.id === commentId)
  try {
    await backend.forum.voteComment(commentId, authStore.user.id, value)
    commentVoteMap.value = { ...commentVoteMap.value, [commentId]: value }
    if (comment) comment.vote_score = comment.vote_score - prev + value
  } catch {
    toastStore.show('Failed to vote', 'error')
  }
}

async function handleRemoveCommentVote(commentId: string) {
  if (!authStore.user?.id) return
  const prev = commentVoteMap.value[commentId] ?? 0
  const comment = comments.value.find((c) => c.id === commentId)
  try {
    await backend.forum.removeCommentVote(commentId, authStore.user.id)
    const map = { ...commentVoteMap.value }
    delete map[commentId]
    commentVoteMap.value = map
    if (comment) comment.vote_score -= prev
  } catch {
    toastStore.show('Failed to remove vote', 'error')
  }
}

async function handleReact(commentId: string, emoji: string) {
  if (!authStore.user?.id) return
  try {
    const reaction = await backend.forum.reactToComment(commentId, authStore.user.id, emoji)
    const list = reactionMap.value[commentId] ?? []
    reactionMap.value = { ...reactionMap.value, [commentId]: [...list, reaction] }
  } catch {
    toastStore.show('Failed to add reaction', 'error')
  }
}

async function handleRemoveReaction(commentId: string, emoji: string) {
  if (!authStore.user?.id) return
  try {
    await backend.forum.removeCommentReaction(commentId, authStore.user.id, emoji)
    const list = (reactionMap.value[commentId] ?? []).filter(
      (r) => !(r.user_id === authStore.user!.id && r.emoji === emoji)
    )
    reactionMap.value = { ...reactionMap.value, [commentId]: list }
  } catch {
    toastStore.show('Failed to remove reaction', 'error')
  }
}

async function handleEditComment(commentId: string, content: string) {
  if (!authStore.user?.id) return
  try {
    const updated = await backend.forum.editComment(commentId, authStore.user.id, content)
    const idx = comments.value.findIndex((c) => c.id === commentId)
    if (idx !== -1) comments.value[idx] = { ...comments.value[idx]!, ...updated }
  } catch {
    toastStore.show('Failed to edit comment', 'error')
  }
}

async function handleDeleteComment(commentId: string) {
  if (!authStore.user?.id) return
  try {
    await backend.forum.deleteComment(commentId, authStore.user.id)
    const c = comments.value.find((x) => x.id === commentId)
    if (c) c.is_deleted = true
  } catch {
    toastStore.show('Failed to delete comment', 'error')
  }
}

function openEmojiDrawer(event: MouseEvent) {
  if (emojiDrawerOpen.value) { emojiDrawerOpen.value = false; return }
  const btn = event.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  emojiDrawerAnchor.value = { bottom: window.innerHeight - rect.top + 8, right: window.innerWidth - rect.right }
  emojiDrawerOpen.value = true
}

function insertEmoji(emoji: string) {
  commentInputEl.value?.insertEmoji(emoji)
  emojiDrawerOpen.value = false
}

defineExpose({ count: computed(() => comments.value.length) })
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">

    <!-- Loading -->
    <div v-if="loading" class="flex flex-1 items-center justify-center">
      <div class="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>

    <!-- Comment tree -->
    <div v-else class="flex-1 overflow-y-auto px-2 py-2">
      <ForumCommentTree
        :comments="comments"
        :parent-id="null"
        :depth="0"
        :compact="true"
        :can-post="!!authStore.user"
        :user-votes="commentVoteMap"
        :reactions="reactionMap"
        :current-user-id="authStore.user?.id ?? null"
        @reply="handleReply"
        @vote="handleCommentVote"
        @remove-vote="handleRemoveCommentVote"
        @react="handleReact"
        @remove-reaction="handleRemoveReaction"
        @edit="handleEditComment"
        @delete="handleDeleteComment"
      />
      <p v-if="comments.length === 0" class="py-6 text-center text-xs text-text-muted">No comments yet.</p>
    </div>

    <!-- Comment input -->
    <div v-if="authStore.user" class="flex-shrink-0 border-t border-bg-tertiary px-2 py-2">
      <div class="rounded-lg bg-bg-primary ring-1 ring-bg-tertiary focus-within:ring-accent overflow-hidden">
        <MessageInput
          ref="commentInputEl"
          v-model="newComment"
          placeholder="Write a comment…"
          @submit="submitComment"
          class="px-2.5 py-2 text-sm"
        />
        <div class="flex items-center justify-between border-t border-bg-tertiary px-2.5 py-1">
          <button
            type="button"
            @click="openEmojiDrawer($event)"
            :class="emojiDrawerOpen ? 'text-accent' : 'text-text-muted hover:text-text-primary'"
            class="rounded p-0.5 transition-colors"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <circle cx="12" cy="12" r="10"/>
              <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
              <line x1="9" y1="9" x2="9.01" y2="9" stroke-linecap="round" stroke-width="2.5"/>
              <line x1="15" y1="9" x2="15.01" y2="9" stroke-linecap="round" stroke-width="2.5"/>
            </svg>
          </button>
          <button
            @click="submitComment"
            :disabled="!newComment.trim() || posting"
            class="rounded bg-accent px-2.5 py-0.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >Post</button>
        </div>
      </div>
    </div>

  </div>

  <Teleport to="body">
    <div
      v-if="emojiDrawerOpen && emojiDrawerAnchor"
      class="fixed z-[9997]"
      :style="{ bottom: emojiDrawerAnchor.bottom + 'px', right: emojiDrawerAnchor.right + 'px' }"
      @click.stop
    >
      <EmojiPicker @select="insertEmoji" />
    </div>
    <div v-if="emojiDrawerOpen" class="fixed inset-0 z-[9996]" @click="emojiDrawerOpen = false" />
  </Teleport>
</template>
