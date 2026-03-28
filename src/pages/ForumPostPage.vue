<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { backend } from '@/lib/backend'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import UserAvatar from '@/components/user/UserAvatar.vue'
import MessageAttachments from '@/components/messages/MessageAttachments.vue'
import ForumCommentTree from '@/components/forum/ForumCommentTree.vue'
import PageEditor from '@/components/forum/PageEditor.vue'
import RichText from '@/components/ui/RichText.vue'
import InviteCollaboratorDialog from '@/components/forum/InviteCollaboratorDialog.vue'
import MessageInput from '@/components/chat/MessageInput.vue'
import EmojiPicker from '@/components/chat/EmojiPicker.vue'
import type {
  ForumPost, ForumVote, ForumComment, ForumCollaborator,
  ForumCommentReaction, Profile, Message,
} from '@/lib/types'

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

// Comment-level vote + reaction state
const commentVoteMap = ref<Record<string, 1 | -1>>({})
const reactionMap = ref<Record<string, ForumCommentReaction[]>>({})

const newComment = ref('')
const posting = ref(false)
const commentInputEl = ref<InstanceType<typeof MessageInput> | null>(null)
const emojiDrawerOpen = ref(false)
const emojiDrawerAnchor = ref<{ bottom: number; right: number } | null>(null)

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
    const uid = authStore.user?.id
    const [postData, commentData, voteData, commentVotes, reactions] = await Promise.all([
      backend.forum.getPost(postId.value),
      backend.forum.listComments(postId.value),
      uid ? backend.forum.getUserVote(postId.value, uid) : null,
      uid ? backend.forum.getUserCommentVotes(postId.value, uid) : [],
      backend.forum.listCommentReactions(postId.value),
    ])
    post.value = postData
    pageContent.value = postData.content
    comments.value = commentData
    userVote.value = voteData

    // Build comment vote map
    const voteObj: Record<string, 1 | -1> = {}
    for (const v of commentVotes) voteObj[v.comment_id] = v.value
    commentVoteMap.value = voteObj

    // Build reaction map
    const rxnObj: Record<string, ForumCommentReaction[]> = {}
    for (const r of reactions) {
      if (!rxnObj[r.comment_id]) rxnObj[r.comment_id] = []
      rxnObj[r.comment_id]!.push(r)
    }
    reactionMap.value = rxnObj
  } catch {
    toastStore.show('Failed to load forum post', 'error')
  } finally {
    loading.value = false
  }
})

// ── Post voting ──────────────────────────────────────────────────────────────

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

// ── Comment voting ────────────────────────────────────────────────────────────

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

// ── Comment reactions ─────────────────────────────────────────────────────────

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

// ── Comments ──────────────────────────────────────────────────────────────────

async function handleReply(parentId: string | null, content: string) {
  if (!authStore.user?.id) return
  try {
    const comment = await backend.forum.addComment(postId.value, authStore.user.id, content, parentId)
    comments.value.push(comment)
  } catch {
    toastStore.show('Failed to post comment', 'error')
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

function openEmojiDrawer(event: MouseEvent) {
  if (emojiDrawerOpen.value) { emojiDrawerOpen.value = false; return }
  const btn = event.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  emojiDrawerAnchor.value = { bottom: window.innerHeight - rect.top + 8, right: window.innerWidth - rect.right }
  emojiDrawerOpen.value = true
}

function insertCommentEmoji(emoji: string) {
  commentInputEl.value?.insertEmoji(emoji)
  emojiDrawerOpen.value = false
}

// ── Page type ─────────────────────────────────────────────────────────────────

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

function handleCollaboratorAdded(_userId: string) {
  showInviteDialog.value = false
  backend.forum.getPost(postId.value).then((p) => {
    if (post.value) post.value.collaborators = p.collaborators
  }).catch(() => {})
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}


</script>

<template>
  <div class="flex h-screen flex-col bg-bg-primary">
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

      <!-- Page controls -->
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

      <!-- ── PAGE TYPE ──────────────────────────────────────────────────── -->
      <div v-if="isPageType" class="relative flex flex-1 overflow-hidden">
        <div :class="['flex-1 overflow-y-auto px-6 py-8 transition-all', drawerOpen ? 'mr-80' : '']">
          <div class="mx-auto max-w-3xl">
            <div class="mb-6">
              <span class="rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide bg-sky-500/20 text-sky-400">page</span>
              <h1 class="mt-2 text-3xl font-bold text-text-primary">{{ post.title }}</h1>
              <div class="mt-3 flex flex-wrap items-center gap-3 text-sm text-text-muted">
                <div class="flex items-center gap-2">
                  <UserAvatar :src="post.created_by_profile?.avatar_url" :alt="post.created_by_profile?.display_name" size="sm" />
                  <span class="font-medium text-text-secondary">{{ post.created_by_profile?.display_name ?? 'Unknown' }}</span>
                </div>
                <span>·</span>
                <span>{{ formatTime(post.created_at) }}</span>
                <span v-if="post.updated_by" class="text-xs">· edited {{ formatTime(post.updated_at) }}</span>
                <div v-if="post.collaborators.length" class="flex items-center gap-1">
                  <span class="text-xs text-text-muted">+</span>
                  <div class="flex -space-x-1.5">
                    <UserAvatar v-for="c in post.collaborators" :key="c.user_id" :src="c.user.avatar_url" :alt="c.user.display_name" size="xs" class="ring-2 ring-bg-primary" :title="c.user.display_name" />
                  </div>
                </div>
                <button v-if="canInvite" @click="showInviteDialog = true" class="ml-1 flex items-center gap-1 rounded-md bg-bg-secondary px-2 py-0.5 text-xs text-text-muted hover:bg-bg-hover hover:text-text-primary">
                  <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Invite
                </button>
              </div>
            </div>

            <!-- Source message -->
            <div v-if="post.source_message" class="mb-6 rounded-lg border border-bg-tertiary bg-bg-secondary px-4 py-3">
              <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Original message</p>
              <div class="flex gap-2.5">
                <UserAvatar :src="post.source_message.profile?.avatar_url" :alt="post.source_message.profile?.display_name" size="sm" class="flex-shrink-0 mt-0.5" />
                <div class="min-w-0">
                  <span class="text-sm font-semibold text-text-primary">{{ post.source_message.profile?.display_name }}</span>
                  <p class="mt-0.5 break-words text-sm text-text-secondary">{{ post.source_message.content }}</p>
                  <MessageAttachments v-if="post.source_message.attachments?.length" :attachments="post.source_message.attachments" class="mt-2" />
                </div>
              </div>
            </div>

            <PageEditor v-model="pageContent" :editable="canEdit" />
            <p v-if="!canEdit && !pageContent" class="mt-8 text-center text-sm text-text-muted italic">This page has no content yet.</p>
          </div>
        </div>

        <!-- Comment drawer -->
        <aside v-if="drawerOpen" class="absolute right-0 top-0 bottom-0 w-80 overflow-y-auto border-l border-bg-tertiary bg-bg-secondary px-4 py-6">
          <h3 class="mb-4 text-sm font-semibold text-text-primary">Comments</h3>
          <div class="mb-4">
            <div class="rounded-lg bg-bg-primary ring-1 ring-bg-tertiary focus-within:ring-accent overflow-hidden">
              <textarea placeholder="Write a comment…" class="w-full bg-transparent px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none resize-none" v-model="newComment" rows="3" @keydown.ctrl.enter="submitTopComment" />
              <div class="flex justify-end border-t border-bg-tertiary px-3 py-1.5">
                <button @click="submitTopComment" :disabled="!newComment.trim() || posting" class="rounded bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50">Comment</button>
              </div>
            </div>
          </div>
          <ForumCommentTree :comments="comments" :parent-id="null" :depth="0" :can-post="!!authStore.user" :user-votes="commentVoteMap" :reactions="reactionMap" :current-user-id="authStore.user?.id ?? null" @reply="handleReply" @vote="handleCommentVote" @remove-vote="handleRemoveCommentVote" @react="handleReact" @remove-reaction="handleRemoveReaction" @edit="handleEditComment" />
          <p v-if="comments.length === 0" class="text-center text-xs text-text-muted py-4">No comments yet.</p>
        </aside>
      </div>

      <!-- ── THREAD TYPE ────────────────────────────────────────────────── -->
      <div v-else class="relative flex flex-1 flex-col overflow-hidden">
        <div class="flex-1 overflow-y-auto">
        <div class="mx-auto w-full max-w-3xl px-6 py-8 pb-4">
        <!-- Post header -->
        <div class="mb-5">
          <div class="mb-2 flex items-center gap-2">
            <span class="rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide bg-violet-500/20 text-violet-400">thread</span>
          </div>
          <h1 class="text-2xl font-bold text-text-primary">{{ post.title }}</h1>
          <div class="mt-2 flex items-center gap-3 text-sm text-text-muted">
            <UserAvatar :src="post.created_by_profile?.avatar_url" :alt="post.created_by_profile?.display_name" size="sm" class="flex-shrink-0" />
            <span class="font-medium text-text-secondary">{{ post.created_by_profile?.display_name ?? 'Unknown' }}</span>
            <span v-if="(post.created_by_profile?.meta_points ?? 0) > 0" class="flex items-center gap-1">
              <span class="text-violet-400">▲</span>
              <span>{{ post.created_by_profile?.meta_points }} meta</span>
            </span>
            <span>·</span>
            <span>{{ formatTime(post.created_at) }}</span>
          </div>
        </div>

        <!-- Source message + OP body block -->
        <div class="mb-3 rounded-lg border border-bg-tertiary bg-bg-secondary overflow-hidden">
          <!-- Source message -->
          <div v-if="post.source_message" class="px-4 pt-4 pb-3">
            <p class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Original message</p>
            <div class="flex gap-2.5">
              <UserAvatar :src="post.source_message.profile?.avatar_url" :alt="post.source_message.profile?.display_name" size="sm" class="flex-shrink-0 mt-0.5" />
              <div class="min-w-0">
                <span class="text-sm font-semibold text-text-primary">{{ post.source_message.profile?.display_name }}</span>
                <p class="mt-0.5 break-words text-sm text-text-secondary">{{ post.source_message.content }}</p>
                <MessageAttachments v-if="post.source_message.attachments?.length" :attachments="post.source_message.attachments" class="mt-2" />
              </div>
            </div>
          </div>

          <!-- Reply indicator + OP body -->
          <div v-if="post.body" class="relative px-4 pb-4" :class="post.source_message ? 'pt-0' : 'pt-4'">
            <!-- Vertical reply line -->
            <div v-if="post.source_message" class="absolute left-8 top-0 bottom-4 w-0.5 bg-bg-tertiary" />
            <div v-if="post.source_message" class="absolute left-8 top-0 h-4 w-4 rounded-bl-lg border-b border-l border-bg-tertiary bg-transparent" style="margin-left: 0" />

            <div class="flex gap-2.5" :class="post.source_message ? 'ml-6 mt-3' : ''">
              <UserAvatar :src="post.created_by_profile?.avatar_url" :alt="post.created_by_profile?.display_name" size="sm" class="flex-shrink-0 mt-0.5" />
              <div class="min-w-0 flex-1 rounded-lg bg-bg-primary px-3 py-2.5">
                <span class="text-sm font-semibold text-text-primary">{{ post.created_by_profile?.display_name ?? 'Unknown' }}</span>
                <p class="mt-0.5 break-words text-sm text-text-secondary leading-relaxed"><RichText :text="post.body" /></p>
              </div>
            </div>
          </div>
        </div>

        <!-- Vote bar -->
        <div class="mb-3 px-2 flex items-baseline gap-3">
          <button @click="handleVote(1)" class="flex items-center gap-1 rounded-md px-1.5 py-1.5 text-sm font-medium transition-colors" :class="userVote?.value === 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-bg-secondary text-text-muted hover:bg-bg-hover hover:text-emerald-400'">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l8 8H4z"/></svg>
          </button>
          <span class="flex items-baseline gap-1.5">
            <span class="font-bold" :class="post.vote_score > 0 ? 'text-emerald-400' : post.vote_score < 0 ? 'text-red-400' : 'text-text-muted'">{{ post.vote_score }}</span>
            <span class="text-sm font-semibold text-violet-400">meta</span>
          </span>
          <button @click="handleVote(-1)" class="flex items-center gap-1 rounded-md px-1.5 py-1.5 text-sm font-medium transition-colors" :class="userVote?.value === -1 ? 'bg-red-500/20 text-red-400' : 'bg-bg-secondary text-text-muted hover:bg-bg-hover hover:text-red-400'">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20l-8-8h16z"/></svg>
          </button>
          <span class="text-sm text-text-muted">{{ comments.length }} comment{{ comments.length !== 1 ? 's' : '' }}</span>
        </div>

        <hr class="mb-6 border-bg-tertiary" />

        <!-- Comment tree -->
        <ForumCommentTree
          :comments="comments"
          :parent-id="null"
          :depth="0"
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
        />
          <p v-if="comments.length === 0" class="text-center text-sm text-text-muted py-4">No comments yet. Be the first!</p>
        </div>
        </div>

        <!-- Floating comment input bar -->
        <div class="bg-bg-primary px-6 pb-4 pt-2">
          <form @submit.prevent="submitTopComment" class="mx-auto flex w-full max-w-3xl items-center gap-2 rounded-xl bg-bg-tertiary px-4 py-3 shadow-lg shadow-black/30 ring-1 ring-bg-tertiary/50">
            <MessageInput
              ref="commentInputEl"
              v-model="newComment"
              placeholder="Write a comment…"
              @submit="submitTopComment"
            />
            <!-- Emoji button -->
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
              :disabled="!newComment.trim() || posting"
              class="min-w-8 rounded p-1 text-text-muted transition-colors hover:text-text-primary disabled:opacity-30"
            >
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </form>
        </div>
      </div>
    </template>

    <div v-else class="flex flex-1 items-center justify-center text-text-muted">Post not found.</div>

    <InviteCollaboratorDialog
      v-if="showInviteDialog && post && authStore.user"
      :post-id="post.id"
      :invited-by="authStore.user.id"
      :existing-user-ids="collaboratorIds"
      @added="handleCollaboratorAdded"
      @close="showInviteDialog = false"
    />

  <Teleport to="body">
    <div
      v-if="emojiDrawerOpen && emojiDrawerAnchor"
      class="fixed z-[9997]"
      :style="{ bottom: emojiDrawerAnchor.bottom + 'px', right: emojiDrawerAnchor.right + 'px' }"
      @click.stop
    >
      <EmojiPicker @select="insertCommentEmoji" />
    </div>
    <div
      v-if="emojiDrawerOpen"
      class="fixed inset-0 z-[9996]"
      @click="emojiDrawerOpen = false"
    />
  </Teleport>
  </div>
</template>
