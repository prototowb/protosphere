<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { backend } from '@/lib/backend'
import { formatDateTime, escapeHtml } from '@/lib/formatters'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { useUiStore } from '@/stores/ui'
import UserAvatar from '@/components/user/UserAvatar.vue'
import ForumCommentTree from '@/components/forum/ForumCommentTree.vue'
import PostHero from '@/components/forum/PostHero.vue'
import ThreadPostCard from '@/components/forum/ThreadPostCard.vue'
import VoteButtons from '@/components/chat/VoteButtons.vue'
import BlockEditor from '@/components/editor/BlockEditor.vue'
import BlockRenderer from '@/components/editor/BlockRenderer.vue'
import InviteCollaboratorDialog from '@/components/forum/InviteCollaboratorDialog.vue'
import MessageInput from '@/components/chat/MessageInput.vue'
import EmojiPickerPopover from '@/components/ui/EmojiPickerPopover.vue'
import type {
  ForumPost, ForumVote, ForumComment, ForumCollaborator,
  ForumCommentReaction, Profile, Message, PageContent,
} from '@/lib/types'

const props = defineProps<{ postId: string; spaceId: string; commentCount?: number }>()
const emit = defineEmits<{ back: [] }>()

const authStore = useAuthStore()
const toastStore = useToastStore()
const uiStore = useUiStore()

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
const savedContent = ref<PageContent>({ blocks: [], customCss: '' })
const pageContent = ref<PageContent>({ blocks: [], customCss: '' })
const editingTitle = ref('')
const savingPage = ref(false)
const editingPage = ref(false)
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

async function loadPost() {
  loading.value = true
  post.value = null
  comments.value = []
  userVote.value = null
  commentVoteMap.value = {}
  reactionMap.value = {}
  try {
    const uid = authStore.user?.id
    const [postData, commentData, voteData, commentVotes, reactions] = await Promise.all([
      backend.forum.getPost(props.postId),
      backend.forum.listComments(props.postId),
      uid ? backend.forum.getUserVote(props.postId, uid) : null,
      uid ? backend.forum.getUserCommentVotes(props.postId, uid) : [],
      backend.forum.listCommentReactions(props.postId),
    ])
    post.value = postData
    const c = postData.content as PageContent | null
    const validated: PageContent = (c && Array.isArray(c.blocks)) ? c : { blocks: [], customCss: '' }
    // Auto-seed pinned source message block when the page has no content yet
    if (validated.blocks.length === 0 && postData.source_message?.content) {
      const id = genId()
      const _author = postData.source_message.profile?.display_name || undefined
      const _date = postData.source_message.created_at || undefined
      const html = `<p>${escapeHtml(postData.source_message.content)}</p>`
      validated.blocks = [{ id, type: 'text' as const, html, _author, _date, _pinned: true as const, _variant: 'quote' as const }]
    }
    savedContent.value = validated
    pageContent.value = JSON.parse(JSON.stringify(validated))
    editingPage.value = false
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
}

onMounted(loadPost)
watch(() => props.postId, loadPost)

// ── Post voting ──────────────────────────────────────────────────────────────

async function handleVote(value: 1 | -1) {
  if (!authStore.user?.id || !post.value) return
  try {
    if (userVote.value?.value === value) {
      await backend.forum.removeVote(props.postId, authStore.user.id)
      post.value.vote_score -= value
      userVote.value = null
    } else {
      const prev = userVote.value?.value ?? 0
      const vote = await backend.forum.vote(props.postId, authStore.user.id, value)
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
    const comment = await backend.forum.addComment(props.postId, authStore.user.id, content, parentId)
    comments.value.push(comment)
    commentVoteMap.value = { ...commentVoteMap.value, [comment.id]: 1 }
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

async function handleDeletePost() {
  if (!authStore.user?.id || !post.value) return
  try {
    await backend.forum.deletePost(post.value.id)
    toastStore.show('Post deleted', 'info')
    emit('back')
  } catch {
    toastStore.show('Failed to delete post', 'error')
  }
}

async function submitTopComment() {
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
  if (!authStore.user?.id) return
  savingPage.value = true
  try {
    const newTitle = editingTitle.value.trim() || (post.value?.title ?? '')
    const updated = await backend.forum.updatePageContent(props.postId, pageContent.value, authStore.user.id, newTitle)
    if (post.value) {
      post.value.updated_at = updated.updated_at
      post.value.updated_by = updated.updated_by
      post.value.title = newTitle
    }
    savedContent.value = JSON.parse(JSON.stringify(pageContent.value))
    editingPage.value = false
    toastStore.show('Page saved', 'success')
  } catch {
    toastStore.show('Failed to save page', 'error')
  } finally {
    savingPage.value = false
  }
}

function cancelEdit() {
  pageContent.value = JSON.parse(JSON.stringify(savedContent.value))
  editingTitle.value = post.value?.title ?? ''
  editingPage.value = false
}

function startEditing() {
  editingTitle.value = post.value?.title ?? ''
  editingPage.value = true
  // Auto-seed a pinned message text block when blocks are empty and source message has content
  if (pageContent.value.blocks.length === 0 && post.value?.source_message?.content) {
    const id = genId()
    const _author = post.value.source_message.profile?.display_name || undefined
    const _date = post.value.source_message.created_at || undefined
    const html = `<p>${escapeHtml(post.value.source_message.content)}</p>`
    pageContent.value = {
      ...pageContent.value,
      blocks: [{ id, type: 'text' as const, html, _author, _date, _pinned: true as const, _variant: 'quote' as const }],
    }
  }
}

const lockedHeroSubtitle = computed(() => {
  if (!post.value) return ''
  const parts = [`by ${post.value.created_by_profile?.display_name ?? 'Unknown'}`, formatDateTime(post.value.created_at)]
  if (post.value.collaborators.length) {
    parts.push(`+${post.value.collaborators.length} collaborator${post.value.collaborators.length > 1 ? 's' : ''}`)
  }
  return parts.join(' · ')
})

function handleCollaboratorAdded(_userId: string) {
  showInviteDialog.value = false
  backend.forum.getPost(props.postId).then((p) => {
    if (post.value) post.value.collaborators = p.collaborators
  }).catch(() => {})
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function genId() { return Math.random().toString(36).slice(2, 10) }


defineExpose({
  post,
  editingTitle,
  editingPage,
  isPageType,
  canEdit,
  savingPage,
  savePage,
  cancelEdit,
  handleDeletePost,
  startEditing,
})
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">

    <!-- Loading -->
    <div v-if="loading" class="flex flex-1 items-center justify-center">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>

    <div v-else-if="post" class="flex flex-1 flex-col overflow-hidden">

      <!-- ── PAGE TYPE ──────────────────────────────────────────────────── -->
      <div v-if="isPageType" class="flex flex-1 flex-col overflow-hidden">

        <!-- Edit mode: full-height block editor -->
        <div v-if="editingPage" class="flex flex-1 overflow-hidden">
          <BlockEditor
            v-model="pageContent"
            :title="editingTitle"
            :source-message="post.source_message"
            :locked-hero="{ title: editingTitle || post.title, subtitle: lockedHeroSubtitle }"
            @update:title="editingTitle = $event"
            class="flex-1 overflow-hidden"
          />
        </div>

        <!-- View mode: meta + rendered page -->
        <div v-else class="flex-1 overflow-y-auto">
          <div class="mx-auto max-w-3xl px-6 py-8">
            <PostHero
              :title="post.title"
              :created-at="post.created_at"
              :updated-at="post.updated_at"
              :updated-by="post.updated_by"
              :author-name="post.created_by_profile?.display_name ?? 'Unknown'"
              :author-avatar-url="post.created_by_profile?.avatar_url ?? null"
              :collaborators="post.collaborators"
              :hero-style="savedContent.lockedHeroStyle"
              :comment-count="props.commentCount ?? comments.length"
              :can-invite="canInvite"
              :member-sidebar-open="uiStore.memberSidebarOpen"
              @toggle-comments="uiStore.memberSidebarOpen = !uiStore.memberSidebarOpen"
              @invite="showInviteDialog = true"
            />
            <!-- Rendered page content -->
            <BlockRenderer :content="savedContent" />
          </div>
        </div>

      </div>

      <!-- ── THREAD TYPE ────────────────────────────────────────────────── -->
      <div v-else class="flex-1 overflow-y-auto">
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
              <span>{{ formatDateTime(post.created_at) }}</span>
            </div>
          </div>

          <ThreadPostCard
            :source-message="post.source_message"
            :body="post.body"
            :author-name="post.created_by_profile?.display_name ?? 'Unknown'"
            :author-avatar-url="post.created_by_profile?.avatar_url ?? null"
          />

          <!-- Vote bar -->
          <div class="mb-3 px-2 flex items-baseline gap-3">
            <VoteButtons
              :score="post.vote_score"
              :user-vote="userVote?.value ?? null"
              size="md"
              show-label
              @vote="handleVote"
            />
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
            @delete="handleDeleteComment"
          />
          <p v-if="comments.length === 0" class="text-center text-sm text-text-muted py-4">No comments yet. Be the first!</p>
        </div>
      </div>

    </div>

    <!-- Not found -->
    <div v-else class="flex flex-1 items-center justify-center text-text-muted">Post not found.</div>

    <!-- Comment input bar (thread type only) -->
    <div v-if="!isPageType && post" class="flex-shrink-0 bg-bg-primary px-6 pb-4 pt-2">
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

    <InviteCollaboratorDialog
      v-if="showInviteDialog && post && authStore.user"
      :post-id="post.id"
      :invited-by="authStore.user.id"
      :existing-user-ids="collaboratorIds"
      @added="handleCollaboratorAdded"
      @close="showInviteDialog = false"
    />

    <EmojiPickerPopover
      :open="emojiDrawerOpen"
      :anchor="emojiDrawerAnchor"
      @select="insertCommentEmoji"
      @close="emojiDrawerOpen = false"
    />
  </div>
</template>
