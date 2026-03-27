<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { backend } from '@/lib/backend'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import UserAvatar from '@/components/user/UserAvatar.vue'
import ForumCommentTree from '@/components/forum/ForumCommentTree.vue'
import type { ForumPost, ForumVote, ForumComment, Profile, Message } from '@/lib/types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const toastStore = useToastStore()

const postId = computed(() => route.params.postId as string)
const spaceId = computed(() => route.params.spaceId as string)

const loading = ref(true)
const post = ref<(ForumPost & { created_by_profile: Profile; source_message: (Message & { profile: Profile }) | null }) | null>(null)
const comments = ref<(ForumComment & { profile: Profile })[]>([])
const userVote = ref<ForumVote | null>(null)
const newComment = ref('')
const posting = ref(false)

onMounted(async () => {
  try {
    const [postData, commentData, voteData] = await Promise.all([
      backend.forum.getPost(postId.value),
      backend.forum.listComments(postId.value),
      authStore.user?.id ? backend.forum.getUserVote(postId.value, authStore.user.id) : null,
    ])
    post.value = postData
    comments.value = commentData
    userVote.value = voteData
  } catch {
    toastStore.show('Failed to load forum post', 'error')
  } finally {
    loading.value = false
  }
})

async function handleVote(value: 1 | -1) {
  if (!authStore.user?.id || !post.value) return
  try {
    if (userVote.value?.value === value) {
      await backend.forum.removeVote(postId.value, authStore.user.id)
      post.value.vote_score -= value
      userVote.value = null
    } else {
      const prev = userVote.value?.value ?? 0
      const vote = await backend.forum.vote(postId.value, authStore.user.id, value)
      post.value.vote_score = post.value.vote_score - prev + value
      userVote.value = vote
    }
  } catch {
    toastStore.show('Failed to record vote', 'error')
  }
}

async function handleReply(parentId: string | null, content: string) {
  if (!authStore.user?.id) return
  try {
    const comment = await backend.forum.addComment(postId.value, authStore.user.id, content, parentId)
    comments.value.push(comment)
  } catch {
    toastStore.show('Failed to post comment', 'error')
  }
}

async function submitTopComment() {
  const content = newComment.value.trim()
  if (!content || posting.value || !authStore.user?.id) return
  posting.value = true
  try {
    const comment = await backend.forum.addComment(postId.value, authStore.user.id, content, null)
    comments.value.push(comment)
    newComment.value = ''
  } catch {
    toastStore.show('Failed to post comment', 'error')
  } finally {
    posting.value = false
  }
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-bg-primary">
    <!-- Top bar -->
    <div class="flex items-center gap-3 border-b border-bg-tertiary bg-bg-secondary px-6 py-3">
      <button
        @click="router.push(`/channels/${spaceId}/${spaceId}`)"
        class="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Back to space
      </button>
      <span class="text-text-muted">/</span>
      <span class="text-sm font-medium text-text-primary">Forum</span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-1 items-center justify-center">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>

    <template v-else-if="post">
      <div class="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <!-- Post header -->
        <div class="mb-6">
          <div class="mb-2 flex items-center gap-2">
            <span
              class="rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide"
              :class="post.type === 'meta' ? 'bg-violet-500/20 text-violet-400' : 'bg-sky-500/20 text-sky-400'"
            >
              {{ post.type }}
            </span>
          </div>
          <h1 class="text-2xl font-bold text-text-primary">{{ post.title }}</h1>
          <div class="mt-2 flex items-center gap-3 text-sm text-text-muted">
            <UserAvatar
              :src="post.created_by_profile?.avatar_url"
              :alt="post.created_by_profile?.display_name"
              size="sm"
              class="flex-shrink-0"
            />
            <span class="font-medium text-text-secondary">{{ post.created_by_profile?.display_name ?? 'Unknown' }}</span>
            <span v-if="(post.created_by_profile?.meta_points ?? 0) > 0" class="flex items-center gap-1">
              <span class="text-violet-400">▲</span>
              <span>{{ post.created_by_profile?.meta_points }} meta</span>
            </span>
            <span>·</span>
            <span>{{ formatTime(post.created_at) }}</span>
          </div>
        </div>

        <!-- Source message quote -->
        <div
          v-if="post.source_message"
          class="mb-6 rounded-lg border border-bg-tertiary bg-bg-secondary px-4 py-3"
        >
          <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Original message</p>
          <div class="flex gap-2.5">
            <UserAvatar
              :src="post.source_message.profile?.avatar_url"
              :alt="post.source_message.profile?.display_name"
              size="sm"
              class="flex-shrink-0 mt-0.5"
            />
            <div class="min-w-0">
              <span class="text-sm font-semibold text-text-primary">{{ post.source_message.profile?.display_name }}</span>
              <p class="mt-0.5 break-words text-sm text-text-secondary">{{ post.source_message.content }}</p>
            </div>
          </div>
        </div>

        <!-- Vote bar (meta posts) -->
        <div v-if="post.type === 'meta'" class="mb-6 flex items-center gap-3">
          <button
            @click="handleVote(1)"
            class="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            :class="userVote?.value === 1
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-bg-secondary text-text-muted hover:bg-bg-hover hover:text-emerald-400'"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l8 8H4z"/></svg>
            Upvote
          </button>
          <span
            class="text-lg font-bold"
            :class="post.vote_score > 0 ? 'text-emerald-400' : post.vote_score < 0 ? 'text-red-400' : 'text-text-muted'"
          >
            {{ post.vote_score }}
          </span>
          <button
            @click="handleVote(-1)"
            class="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            :class="userVote?.value === -1
              ? 'bg-red-500/20 text-red-400'
              : 'bg-bg-secondary text-text-muted hover:bg-bg-hover hover:text-red-400'"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20l-8-8h16z"/></svg>
            Downvote
          </button>
          <span class="text-sm text-text-muted">{{ comments.length }} comment{{ comments.length !== 1 ? 's' : '' }}</span>
        </div>

        <hr class="mb-6 border-bg-tertiary" />

        <!-- Comment input -->
        <div class="mb-6">
          <textarea
            v-model="newComment"
            placeholder="Write a comment…"
            rows="3"
            class="w-full resize-none rounded-lg bg-bg-secondary px-4 py-3 text-sm text-text-primary placeholder-text-muted outline-none ring-1 ring-bg-tertiary focus:ring-accent"
            @keydown.ctrl.enter="submitTopComment"
          />
          <div class="mt-2 flex justify-end">
            <button
              @click="submitTopComment"
              :disabled="!newComment.trim() || posting"
              class="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              Comment
            </button>
          </div>
        </div>

        <!-- Comment tree -->
        <ForumCommentTree
          :comments="comments"
          :parent-id="null"
          :depth="0"
          :can-post="!!authStore.user"
          @reply="handleReply"
        />

        <p v-if="comments.length === 0" class="text-center text-sm text-text-muted py-4">
          No comments yet. Be the first!
        </p>
      </div>
    </template>

    <div v-else class="flex flex-1 items-center justify-center text-text-muted">
      Post not found.
    </div>
  </div>
</template>
