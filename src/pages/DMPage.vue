<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '@/components/layout/AppShell.vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
import EmojiPicker from '@/components/chat/EmojiPicker.vue'
import MessageSearch from '@/components/chat/MessageSearch.vue'
import { useAuthStore } from '@/stores/auth'
import { useDmsStore } from '@/stores/dms'
import { useDMs } from '@/composables/useDMs'
import { renderMessage } from '@/lib/mentions'
import { useToastStore } from '@/stores/toast'
import { useContextMenuStore } from '@/stores/contextMenu'
import { dmMessageContextItems, dmConversationContextItems } from '@/lib/contextMenuItems'
import { useDmUnread } from '@/composables/useDmUnread'
import { useTyping } from '@/composables/useTyping'
import { useRealtime } from '@/composables/useRealtime'
import { useMessageSearch } from '@/composables/useMessageSearch'
import { useProfile } from '@/composables/useProfile'
import { isLocalMode } from '@/lib/backend'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import type { DirectMessage, Profile } from '@/lib/types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const store = useDmsStore()
const toastStore = useToastStore()
const contextMenuStore = useContextMenuStore()
const { fetchGroups, openDM, fetchMessages, sendMessage, editMessage, deleteMessage, searchUsers } = useDMs()
const { unreadDmGroupIds, markDmRead, refreshDmUnread } = useDmUnread()
const { profile: myProfile, fetchProfile: fetchMyProfile } = useProfile()
const { typingUsers, onTyping: localOnTyping, onSent: localOnSent, startListening, stopListening } = useTyping(
  () => store.activeDmGroupId,
  () => myProfile.value?.display_name ?? authStore.user?.email?.split('@')[0] ?? 'Someone',
)
const { startDmMessages, stopDmMessages, startTypingChannel, broadcastTyping, broadcastStopTyping, stopTypingChannel } = useRealtime()
const realtimeTypingUsers = ref<string[]>([])
const { query: dmSearchQuery, results: dmSearchResults, isOpen: dmSearchOpen, open: openDmSearch, close: closeDmSearch } = useMessageSearch(() => messages.value)

const messageInput = ref('')
const messageInputEl = ref<HTMLInputElement | null>(null)
const sending = ref(false)
const messageListEl = ref<HTMLElement | null>(null)

// Emoji drawer
const emojiDrawerOpen = ref(false)
const emojiDrawerAnchor = ref<{ bottom: number; right: number } | null>(null)

function openEmojiDrawer(event: MouseEvent) {
  if (emojiDrawerOpen.value) {
    emojiDrawerOpen.value = false
    return
  }
  const btn = event.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  emojiDrawerAnchor.value = { bottom: window.innerHeight - rect.top + 8, right: window.innerWidth - rect.right }
  emojiDrawerOpen.value = true
}

function insertEmoji(emoji: string) {
  const input = messageInputEl.value
  if (!input) {
    messageInput.value += emoji
    return
  }
  const start = input.selectionStart ?? messageInput.value.length
  const end = input.selectionEnd ?? messageInput.value.length
  messageInput.value = messageInput.value.slice(0, start) + emoji + messageInput.value.slice(end)
  nextTick(() => {
    input.focus()
    const pos = start + [...emoji].length
    input.setSelectionRange(pos, pos)
  })
}

const editingId = ref<string | null>(null)
const editingContent = ref('')

// Reply state
const replyingTo = ref<(DirectMessage & { profile: Profile }) | null>(null)

function startReply(msg: DirectMessage & { profile: Profile }) {
  replyingTo.value = msg
  nextTick(() => messageInputEl.value?.focus())
}

function cancelReply() {
  replyingTo.value = null
}

function getDmMessageById(id: string): (DirectMessage & { profile: Profile }) | undefined {
  return messages.value.find((m) => m.id === id)
}

const showNewDM = ref(false)
const searchQuery = ref('')
const searchResults = ref<Profile[]>([])
const searching = ref(false)

const dmGroupId = computed(() => route.params.dmGroupId as string | undefined)

const activeGroup = computed(() =>
  store.groups.find((g) => g.id === dmGroupId.value),
)

const messages = computed((): (DirectMessage & { profile: Profile })[] => {
  const id = dmGroupId.value
  return id ? (store.messagesByGroup[id] ?? []) as (DirectMessage & { profile: Profile })[] : []
})

onMounted(async () => {
  await fetchGroups()
  fetchMyProfile()
  refreshDmUnread()
  if (dmGroupId.value) loadMessages(dmGroupId.value)
  startListening()
})

onUnmounted(() => {
  stopListening()
  stopDmMessages()
  stopTypingChannel()
})

watch(dmGroupId, (id) => {
  if (id) {
    store.activeDmGroupId = id
    loadMessages(id)
    markDmRead(id)
  } else {
    store.activeDmGroupId = null
  }
})

function loadMessages(id: string) {
  store.activeDmGroupId = id
  fetchMessages(id).then(() => scrollToBottom())
  if (!isLocalMode) {
    stopDmMessages()
    stopTypingChannel()
    realtimeTypingUsers.value = []
    startDmMessages(id)
    startTypingChannel(id, (names) => { realtimeTypingUsers.value = names })
  }
}

const displayTypingUsers = computed(() => isLocalMode ? typingUsers.value : realtimeTypingUsers.value)

function handleInput() {
  localOnTyping()
  if (!isLocalMode && authStore.user?.id) {
    broadcastTyping(authStore.user.id, myProfile.value?.display_name ?? authStore.user.email?.split('@')[0] ?? 'Someone')
  }
}

watch(messages, scrollToBottom)

function scrollToBottom() {
  nextTick(() => {
    if (messageListEl.value) {
      messageListEl.value.scrollTop = messageListEl.value.scrollHeight
    }
  })
}

async function handleSend() {
  const content = messageInput.value.trim()
  if (!content || sending.value || !dmGroupId.value) return
  sending.value = true
  const replyId = replyingTo.value?.id ?? null
  try {
    messageInput.value = ''
    replyingTo.value = null
    localOnSent()
    if (!isLocalMode && authStore.user?.id) {
      broadcastStopTyping(authStore.user.id, myProfile.value?.display_name ?? 'Someone')
    }
    await sendMessage(dmGroupId.value, content, replyId)
  } finally {
    sending.value = false
  }
}

function startEdit(msg: DirectMessage & { profile: Profile }) {
  editingId.value = msg.id
  editingContent.value = msg.content
}

function cancelEdit() {
  editingId.value = null
  editingContent.value = ''
}

async function submitEdit() {
  if (!editingId.value || !editingContent.value.trim() || !dmGroupId.value) return
  await editMessage(dmGroupId.value, editingId.value, editingContent.value.trim())
  cancelEdit()
}

const confirmDialog = ref<{
  title: string
  message: string
  confirmLabel: string
  danger: boolean
  onConfirm: (input: string) => void
} | null>(null)

function handleDelete(messageId: string) {
  confirmDialog.value = {
    title: 'Delete Message',
    message: 'Are you sure you want to delete this message? This cannot be undone.',
    confirmLabel: 'Delete',
    danger: true,
    onConfirm: async () => {
      confirmDialog.value = null
      if (!dmGroupId.value) return
      await deleteMessage(dmGroupId.value, messageId)
    },
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, (q) => {
  if (searchTimer) clearTimeout(searchTimer)
  if (!q.trim()) { searchResults.value = []; return }
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      searchResults.value = await searchUsers(q)
    } finally {
      searching.value = false
    }
  }, 300)
})

async function handleOpenDM(userId: string) {
  showNewDM.value = false
  searchQuery.value = ''
  searchResults.value = []
  const groupId = await openDM(userId)
  router.push(`/channels/@me/${groupId}`)
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
}

type GroupedDM = (DirectMessage & { profile: Profile }) & {
  showHeader: boolean
  dateSeparator: string | null
}

const groupedMessages = computed((): GroupedDM[] => {
  return messages.value.map((msg, i) => {
    const prev = messages.value[i - 1]
    const sameAuthor = prev && prev.author_id === msg.author_id
    const withinWindow = prev && (new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime()) < 5 * 60 * 1000
    const showHeader = !sameAuthor || !withinWindow

    const currDate = new Date(msg.created_at).toDateString()
    const prevDate = prev ? new Date(prev.created_at).toDateString() : null
    const dateSeparator = currDate !== prevDate ? formatDate(msg.created_at) : null

    return { ...msg, showHeader, dateSeparator }
  })
})

function formatLastMessage(msg: DirectMessage | null): string {
  if (!msg) return 'No messages yet'
  const isMe = msg.author_id === authStore.user?.id
  const preview = msg.content.length > 40 ? msg.content.slice(0, 40) + '…' : msg.content
  return isMe ? `You: ${preview}` : preview
}

// ── Context Menus ─────────────────────────────────────────
function scrollToMessage(messageId: string) {
  nextTick(() => {
    if (!messageListEl.value) return
    const el = messageListEl.value.querySelector(`[data-message-id="${messageId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('bg-accent/10')
      setTimeout(() => el.classList.remove('bg-accent/10'), 2000)
    }
  })
}

function onDmMessageContext(event: MouseEvent, msg: DirectMessage & { profile: Profile }) {
  const isAuthor = msg.author_id === authStore.user?.id
  contextMenuStore.show(event, dmMessageContextItems({
    isAuthor,
    onReply: () => startReply(msg),
    onEdit: () => startEdit(msg),
    onDelete: () => handleDelete(msg.id),
    onCopyText: () => { navigator.clipboard.writeText(msg.content); toastStore.show('Copied to clipboard', 'success') },
  }))
}

function onDmConversationContext(event: MouseEvent, groupId: string) {
  contextMenuStore.show(event, dmConversationContextItems({
    onMarkRead: () => { markDmRead(groupId); toastStore.show('Marked as read', 'info') },
    onCloseConversation: () => { router.push('/channels/@me'); toastStore.show('Conversation closed', 'info') },
  }))
}
</script>

<template>
  <AppShell>
    <template #sidebar-header>
      <div class="flex h-12 items-center justify-between border-b border-bg-tertiary px-4">
        <h2 class="truncate font-semibold">Direct Messages</h2>
        <button
          @click="showNewDM = true"
          class="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary"
          title="New Message"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
    </template>

    <template #sidebar-content>
      <div v-if="store.groups.length === 0" class="px-2 py-4 text-center text-xs text-text-muted">
        No conversations yet.<br/>Start one with the + button above.
      </div>
      <div v-else class="space-y-0.5">
        <button
          v-for="group in store.groups"
          :key="group.id"
          @click="router.push(`/channels/@me/${group.id}`)"
          @contextmenu.prevent="onDmConversationContext($event, group.id)"
          class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-bg-hover"
          :class="dmGroupId === group.id ? 'bg-bg-hover' : ''"
        >
          <UserAvatar
            :src="group.otherUser.avatar_url"
            :alt="group.otherUser.display_name"
            :status="group.otherUser.status"
            size="sm"
          />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-text-primary">{{ group.otherUser.display_name }}</p>
            <p class="truncate text-xs text-text-muted">{{ formatLastMessage(group.lastMessage) }}</p>
          </div>
          <span
            v-if="unreadDmGroupIds.has(group.id)"
            class="ml-auto h-2 w-2 flex-shrink-0 rounded-full bg-white"
          />
        </button>
      </div>
    </template>

    <template #top-bar>
      <header class="flex h-12 items-center gap-2 border-b border-bg-tertiary bg-bg-primary px-4">
        <template v-if="activeGroup">
          <UserAvatar
            :src="activeGroup.otherUser.avatar_url"
            :alt="activeGroup.otherUser.display_name"
            :status="activeGroup.otherUser.status"
            size="sm"
          />
          <span class="font-semibold text-text-primary">{{ activeGroup.otherUser.display_name }}</span>
          <span v-if="activeGroup.otherUser.status_text" class="ml-1 truncate text-sm text-text-muted">
            {{ activeGroup.otherUser.status_text }}
          </span>
          <div class="ml-auto flex items-center gap-1">
            <button
              @click="dmSearchOpen ? closeDmSearch() : openDmSearch()"
              :class="dmSearchOpen ? 'text-text-primary bg-bg-hover' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'"
              class="rounded p-1.5"
              title="Search Messages"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>
          </div>
        </template>
        <template v-else>
          <span class="font-semibold text-text-primary">Direct Messages</span>
        </template>
      </header>
    </template>

    <!-- Message list or welcome screen -->
    <div v-if="!dmGroupId" class="flex h-full flex-col items-center justify-center p-8 text-center">
      <div class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent/20">
        <svg class="h-10 w-10 text-accent" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
      </div>
      <h2 class="mb-2 text-xl font-bold">Welcome, {{ authStore.user?.email?.split('@')[0] ?? 'friend' }}!</h2>
      <p class="mb-4 max-w-md text-text-secondary">
        Send direct messages to other users. Click the + button to start a conversation.
      </p>
      <button
        @click="showNewDM = true"
        class="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
      >
        New Message
      </button>
    </div>

    <div v-else ref="messageListEl" class="flex flex-1 flex-col overflow-y-auto px-4 py-4">
      <!-- Empty state -->
      <div v-if="messages.length === 0" class="flex flex-1 flex-col items-center justify-center py-16 text-center">
        <UserAvatar
          v-if="activeGroup"
          :src="activeGroup.otherUser.avatar_url"
          :alt="activeGroup.otherUser.display_name"
          size="lg"
        />
        <h2 class="mt-4 text-xl font-bold">{{ activeGroup?.otherUser.display_name }}</h2>
        <p class="mt-1 text-text-secondary text-sm">
          This is the beginning of your conversation with {{ activeGroup?.otherUser.display_name }}.
        </p>
      </div>

      <!-- Messages -->
      <div v-else class="flex flex-col gap-0.5">
        <template v-for="msg in groupedMessages" :key="msg.id">
          <div v-if="msg.dateSeparator" class="my-4 flex items-center gap-3">
            <div class="h-px flex-1 bg-bg-tertiary" />
            <span class="text-xs text-text-muted">{{ msg.dateSeparator }}</span>
            <div class="h-px flex-1 bg-bg-tertiary" />
          </div>

          <div
            :data-message-id="msg.id"
            class="group relative flex gap-3 rounded px-2 py-0.5 transition-colors hover:bg-bg-secondary"
            :class="msg.showHeader ? 'mt-3' : ''"
            @contextmenu.prevent="onDmMessageContext($event, msg)"
          >
            <div class="w-10 flex-shrink-0">
              <UserAvatar
                v-if="msg.showHeader"
                :src="msg.profile.avatar_url"
                :alt="msg.profile.display_name"
                size="sm"
              />
            </div>

            <div class="min-w-0 flex-1">
              <!-- Reply preview -->
              <div
                v-if="msg.reply_to_id && getDmMessageById(msg.reply_to_id)"
                class="mb-1 flex items-center gap-1.5 text-xs text-text-muted"
              >
                <svg class="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
                </svg>
                <span class="font-medium text-text-secondary">{{ getDmMessageById(msg.reply_to_id)?.profile.display_name ?? 'Unknown' }}</span>
                <span class="truncate">{{ getDmMessageById(msg.reply_to_id)?.content }}</span>
              </div>

              <div v-if="msg.showHeader" class="mb-0.5 flex items-baseline gap-2">
                <span class="font-semibold text-text-primary">{{ msg.profile.display_name }}</span>
                <span class="text-xs text-text-muted">{{ formatTime(msg.created_at) }}</span>
              </div>

              <div v-if="editingId === msg.id" class="flex gap-2">
                <input
                  v-model="editingContent"
                  @keydown.enter.prevent="submitEdit"
                  @keydown.escape="cancelEdit"
                  class="flex-1 rounded border border-accent bg-bg-primary px-2 py-1 text-sm text-text-primary outline-none"
                  autofocus
                />
                <button @click="submitEdit" class="rounded bg-accent px-2 py-1 text-xs text-white">Save</button>
                <button @click="cancelEdit" class="rounded px-2 py-1 text-xs text-text-muted hover:text-text-primary">Cancel</button>
              </div>

              <p
                v-else
                class="break-words text-sm text-text-primary leading-relaxed"
                v-html="renderMessage(msg.content, null) + (msg.edited_at ? ' <span class=\'text-xs text-text-muted\'>(edited)</span>' : '')"
              />
            </div>

            <div
              v-if="editingId !== msg.id"
              class="absolute right-2 top-0 hidden -translate-y-1/2 items-center gap-1 rounded border border-bg-tertiary bg-bg-primary p-0.5 shadow group-hover:flex"
            >
              <button
                @click="startReply(msg)"
                class="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary"
                title="Reply"
              >
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
                </svg>
              </button>
              <button
                v-if="msg.author_id === authStore.user?.id"
                @click="startEdit(msg)"
                class="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary"
                title="Edit"
              >
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button
                v-if="msg.author_id === authStore.user?.id"
                @click="handleDelete(msg.id)"
                class="rounded p-1 text-text-muted hover:bg-danger/10 hover:text-danger"
                title="Delete"
              >
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>

            <span
              v-if="!msg.showHeader && editingId !== msg.id"
              class="absolute left-2 hidden text-xs text-text-muted group-hover:block"
              style="top: 50%; transform: translateY(-50%)"
            >
              {{ formatTime(msg.created_at) }}
            </span>
          </div>
        </template>
      </div>
    </div>

    <template v-if="dmGroupId" #input>
      <div class="px-4 pb-4">
        <!-- Reply bar -->
        <div v-if="replyingTo" class="mb-1 flex items-center gap-2 rounded bg-bg-secondary px-3 py-2 text-sm text-text-secondary">
          <svg class="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
          </svg>
          <span>Replying to <span class="font-medium text-text-primary">{{ replyingTo.profile.display_name }}</span></span>
          <button @click="cancelReply" class="ml-auto text-text-muted hover:text-text-primary">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <!-- Typing indicator -->
        <div v-if="displayTypingUsers.length > 0" class="px-1 pb-1 text-xs text-text-muted">
          <span class="font-medium text-text-secondary">{{ displayTypingUsers.join(', ') }}</span>
          {{ displayTypingUsers.length === 1 ? 'is' : 'are' }} typing
          <span class="animate-pulse">...</span>
        </div>
        <form @submit.prevent="handleSend" class="flex items-center gap-2 rounded-lg bg-bg-tertiary px-4 py-3">
          <!-- Emoji drawer button -->
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
          <input
            ref="messageInputEl"
            v-model="messageInput"
            type="text"
            :placeholder="`Message ${activeGroup?.otherUser.display_name ?? ''}`"
            class="flex-1 bg-transparent text-text-primary placeholder-text-muted outline-none"
            @input="handleInput"
            @keydown.enter.prevent="handleSend"
          />
          <button
            type="submit"
            :disabled="!messageInput.trim() || sending"
            class="rounded p-1 text-text-muted transition-colors hover:text-text-primary disabled:opacity-30"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </form>
      </div>
    </template>

    <template #members>
      <!-- Search panel -->
      <MessageSearch
        v-if="dmSearchOpen"
        v-model:query="dmSearchQuery"
        :results="dmSearchResults"
        @close="closeDmSearch"
        @select="(id: string) => { closeDmSearch(); scrollToMessage(id) }"
      />

      <!-- Show other user's profile in the member sidebar -->
      <div v-else-if="activeGroup" class="p-4">
        <div class="flex flex-col items-center gap-3 py-4 text-center">
          <UserAvatar
            :src="activeGroup.otherUser.avatar_url"
            :alt="activeGroup.otherUser.display_name"
            :status="activeGroup.otherUser.status"
            size="lg"
          />
          <div>
            <p class="font-semibold">{{ activeGroup.otherUser.display_name }}</p>
            <p class="text-sm text-text-muted">@{{ activeGroup.otherUser.username }}</p>
          </div>
          <p v-if="activeGroup.otherUser.status_text" class="text-xs text-text-secondary">
            {{ activeGroup.otherUser.status_text }}
          </p>
          <p v-if="activeGroup.otherUser.bio" class="text-xs text-text-secondary">
            {{ activeGroup.otherUser.bio }}
          </p>
        </div>
      </div>
      <div v-else></div>
    </template>
  </AppShell>

  <!-- New DM dialog -->
  <div v-if="showNewDM" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="showNewDM = false">
    <div class="w-full max-w-md rounded-lg bg-bg-secondary p-6">
      <h2 class="mb-4 text-xl font-bold">New Message</h2>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search by username or display name…"
        class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
        autofocus
      />

      <div class="mt-3 max-h-60 overflow-y-auto">
        <p v-if="searching" class="py-4 text-center text-sm text-text-muted">Searching…</p>
        <p v-else-if="searchQuery && searchResults.length === 0" class="py-4 text-center text-sm text-text-muted">
          No users found.
        </p>
        <button
          v-for="user in searchResults"
          :key="user.id"
          @click="handleOpenDM(user.id)"
          class="flex w-full items-center gap-3 rounded px-3 py-2 hover:bg-bg-hover"
        >
          <UserAvatar :src="user.avatar_url" :alt="user.display_name" :status="user.status" size="sm" />
          <div class="min-w-0 text-left">
            <p class="truncate text-sm font-medium">{{ user.display_name }}</p>
            <p class="text-xs text-text-muted">@{{ user.username }}</p>
          </div>
        </button>
      </div>

      <div class="mt-4 flex justify-end">
        <button @click="showNewDM = false" class="rounded px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
          Cancel
        </button>
      </div>
    </div>
  </div>

  <!-- Emoji drawer -->
  <Teleport to="body">
    <div
      v-if="emojiDrawerOpen"
      class="fixed z-[9997]"
      :style="{ bottom: emojiDrawerAnchor ? emojiDrawerAnchor.bottom + 'px' : '80px', right: emojiDrawerAnchor ? emojiDrawerAnchor.right + 'px' : '16px' }"
      @click.stop
    >
      <EmojiPicker @select="insertEmoji" />
    </div>
    <div
      v-if="emojiDrawerOpen"
      class="fixed inset-0 z-[9996]"
      @click="emojiDrawerOpen = false"
    />
  </Teleport>

  <!-- Confirm dialog -->
  <ConfirmDialog
    v-if="confirmDialog"
    :title="confirmDialog.title"
    :message="confirmDialog.message"
    :confirm-label="confirmDialog.confirmLabel"
    :danger="confirmDialog.danger"
    @confirm="confirmDialog.onConfirm"
    @cancel="confirmDialog = null"
  />
</template>
