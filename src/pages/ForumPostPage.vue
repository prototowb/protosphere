<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { backend } from '@/lib/backend'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import UserAvatar from '@/components/user/UserAvatar.vue'
import ForumCommentTree from '@/components/forum/ForumCommentTree.vue'
import PageEditor from '@/components/forum/PageEditor.vue'
import InviteCollaboratorDialog from '@/components/forum/InviteCollaboratorDialog.vue'
import type { ForumPost, ForumVote, ForumComment, ForumCollaborator, Profile, Message } from '@/lib/types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const toastStore = useToastStore()

const postId = computed(() => route.params.postId as string)
const spaceId = computed(() => route.params.spaceId as string)

type FullPost = ForumPost & {
  created_by_profile: Profile
  source_message: (Message & { profile: Profile }) | null
  collaborators: (ForumCollaborator & { user: Profile })[]
}

const loading = ref(true)
const post = ref<FullPost | null>(null)
const comments = ref<(ForumComment & { profile: Profile })[]>([])
const userVote = ref<ForumVote | null>(null)
const newComment = ref('')
const posting = ref(false)

// Page type state
const pageContent = ref<Record<string, unknown> | null>(null)
const savingPage = ref(false)
const drawerOpen = ref(false)
const showInviteDialog = ref(false)

const isPageType = computed(() => post.value?.type === 'page')

const canEdit = computed(() => {
  if (!authStore.user?.id || !post.value) return false
  const uid = authStore.user.id
  if (uid === post.value.created_by || uid === post.value.marked_by) return true
  return post.value.collaborators.some((c) => c.user_id === uid)
})

const canInvite = computed(() => {
  if (!authStore.user?.id || !post.value) return false
  const uid = authStore.user.id
  return uid === post.value.created_by || uid === post.value.marked_by
})

const collaboratorIds = computed(() =>
  post.value ? [post.value.created_by, ...post.value.collaborators.map((c) => c.user_id)] : []
)

onMounted(async () => {
  try {
    const [postData, commentData, voteData] = await Promise.all([
      backend.forum.getPost(postId.value),
      backend.forum.listComments(postId.value),
      authStore.user?.id ? backend.forum.getUserVote(postId.value, authStore.user.id) : null,
    ])
    post.value = postData
    pageContent.value = postData.content
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

async function savePage() {
  if (!authStore.user?.id || !pageContent.value) return
  savingPage.value = true
  try {
    const updated = await backend.forum.updatePageContent(postId.value, pageContent.value, authStore.user.id)
    if (post.value) {
      post.value.updated_at = updated.updated_at
      post.value.updated_by = updated.updated_by
    }
    toastStore.show('Page saved', 'success')
  } catch {
    toastStore.show('Failed to save page', 'error')
  } finally {
    savingPage.value = false
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

function handleCollaboratorAdded(userId: string) {
  showInviteDialog.value = false
  // Reload post to get updated collaborator list
  backend.forum.getPost(postId.value).then((p) => {
    if (post.value) post.value.collaborators = p.collaborators
  }).catch(() => {})
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

      <!-- Page controls (right side) -->
      <template v-if="isPageType && post">
        <div class="ml-auto flex items-center gap-2">
          <button
            v-if="canEdit"
            @click="savePage"
            :disabled="savingPage"
            class="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {{ savingPage ? 'Saving…' : 'Save page' }}
          </button>
          <button
            @click="drawerOpen = !drawerOpen"
            :class="[
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              drawerOpen ? 'bg-accent/20 text-accent' : 'bg-bg-secondary text-text-muted hover:bg-bg-hover',
            ]"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {{ comments.length }}
          </button>
        </div>
      </template>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-1 items-center justify-center">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>

    <template v-else-if="post">
      <!-- Page type layout: full-width editor + optional comment drawer -->
      <div v-if="isPageType" class="relative flex flex-1 overflow-hidden">
        <!-- Page content area -->
        <div :class="['flex-1 overflow-y-auto px-6 py-8 transition-all', drawerOpen ? 'mr-80' : '']">
          <div class="mx-auto max-w-3xl">
            <!-- Page header -->
            <div class="mb-6">
              <div class="mb-2 flex items-center gap-2">
                <span class="rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide bg-sky-500/20 text-sky-400">
                  page
                </span>
              </div>
              <h1 class="text-3xl font-bold text-text-primary">{{ post.title }}</h1>

              <!-- Author + collaborators row -->
              <div class="mt-3 flex flex-wrap items-center gap-3 text-sm text-text-muted">
                <div class="flex items-center gap-2">
                  <UserAvatar :src="post.created_by_profile?.avatar_url" :alt="post.created_by_profile?.display_name" size="sm" />
                  <span class="font-medium text-text-secondary">{{ post.created_by_profile?.display_name ?? 'Unknown' }}</span>
                </div>
                <span>·</span>
                <span>{{ formatTime(post.created_at) }}</span>
                <span v-if="post.updated_by" class="text-xs">· edited {{ formatTime(post.updated_at) }}</span>

                <!-- Collaborator badges -->
                <div v-if="post.collaborators.length" class="flex items-center gap-1">
                  <span class="text-xs text-text-muted">+</span>
                  <div class="flex -space-x-1.5">
                    <UserAvatar
                      v-for="c in post.collaborators"
                      :key="c.user_id"
                      :src="c.user.avatar_url"
                      :alt="c.user.display_name"
                      size="xs"
                      class="ring-2 ring-bg-primary"
                      :title="c.user.display_name"
                    />
                  </div>
                </div>

                <button
                  v-if="canInvite"
                  @click="showInviteDialog = true"
                  class="ml-1 flex items-center gap-1 rounded-md bg-bg-secondary px-2 py-0.5 text-xs text-text-muted hover:bg-bg-hover hover:text-text-primary"
                >
                  <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Invite
                </button>
              </div>
            </div>

            <!-- Source message quote -->
            <div
              v-if="post.source_message"
              class="mb-6 rounded-lg border border-bg-tertiary bg-bg-secondary px-4 py-3"
            >
              <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Original message</p>
              <div class="flex gap-2.5">
                <UserAvatar :src="post.source_message.profile?.avatar_url" :alt="post.source_message.profile?.display_name" size="sm" class="flex-shrink-0 mt-0.5" />
                <div class="min-w-0">
                  <span class="text-sm font-semibold text-text-primary">{{ post.source_message.profile?.display_name }}</span>
                  <p class="mt-0.5 break-words text-sm text-text-secondary">{{ post.source_message.content }}</p>
                </div>
              </div>
            </div>

            <!-- Block editor -->
            <PageEditor
              v-model="pageContent"
              :editable="canEdit"
            />

            <p v-if="!canEdit && !pageContent" class="mt-8 text-center text-sm text-text-muted italic">
              This page has no content yet.
            </p>
          </div>
        </div>

        <!-- Comment drawer -->
        <aside
          v-if="drawerOpen"
          class="absolute right-0 top-0 bottom-0 w-80 overflow-y-auto border-l border-bg-tertiary bg-bg-secondary px-4 py-6"
        >
          <h3 class="mb-4 text-sm font-semibold text-text-primary">Comments</h3>

          <div class="mb-4">
            <textarea
              v-model="newComment"
              placeholder="Write a comment…"
              rows="3"
              class="w-full resize-none rounded-lg bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none ring-1 ring-bg-tertiary focus:ring-accent"
              @keydown.ctrl.enter="submitTopComment"
            />
            <div class="mt-1.5 flex justify-end">
              <button
                @click="submitTopComment"
                :disabled="!newComment.trim() || posting"
                class="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                Comment
              </button>
            </div>
          </div>

          <ForumCommentTree
            :comments="comments"
            :parent-id="null"
            :depth="0"
            :can-post="!!authStore.user"
            @reply="handleReply"
          />
          <p v-if="comments.length === 0" class="text-center text-xs text-text-muted py-4">No comments yet.</p>
        </aside>
      </div>

      <!-- Meta type layout: centered, inline comments -->
      <div v-else class="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <!-- Post header -->
        <div class="mb-6">
          <div class="mb-2 flex items-center gap-2">
            <span class="rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide bg-violet-500/20 text-violet-400">
              meta
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

        <!-- Vote bar -->
        <div class="mb-6 flex items-center gap-3">
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

    <!-- Invite collaborator dialog -->
    <InviteCollaboratorDialog
      v-if="showInviteDialog && post && authStore.user"
      :post-id="post.id"
      :invited-by="authStore.user.id"
      :existing-user-ids="collaboratorIds"
      @added="handleCollaboratorAdded"
      @close="showInviteDialog = false"
    />
  </div>
</template>
