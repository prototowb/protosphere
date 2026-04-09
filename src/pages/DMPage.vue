<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '@/components/layout/AppShell.vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import MessageInputArea from '@/components/chat/MessageInputArea.vue'
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
import { useDmNotificationPreferences } from '@/composables/useDmNotificationPreferences'
import { isLocalMode } from '@/lib/backend'
import { formatDate } from '@/lib/formatters'
import { expandShortcodes } from '@/lib/emojiNames'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DmConversationPane from '@/components/dm/DmConversationPane.vue'
import { useDmTabsStore } from '@/stores/dmTabs'
import type { DirectMessage, Profile } from '@/lib/types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const store = useDmsStore()
const dmTabsStore = useDmTabsStore()
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
const { isMuted, loadMute, setMute } = useDmNotificationPreferences()

const messageInput = ref('')
const sending = ref(false)
const messageListEl = ref<HTMLElement | null>(null)

const editingId = ref<string | null>(null)
const editingContent = ref('')

// Reply state
const replyingTo = ref<(DirectMessage & { profile: Profile }) | null>(null)

function startReply(msg: DirectMessage & { profile: Profile }) {
  replyingTo.value = msg
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
    dmTabsStore.openTab(id)
    loadMessages(id)
    markDmRead(id)
    if (authStore.user?.id) loadMute(authStore.user.id, id).catch(() => {})
  } else {
    store.activeDmGroupId = null
  }
})

// ── Drag-and-drop split view ──────────────────────────────────────────────
const isDragTarget = ref(false)

function onDragOver(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('application/x-dm-group-id')) return
  event.preventDefault()
  isDragTarget.value = true
}

function onDragLeave(event: DragEvent) {
  // Only clear if leaving the container itself (not a child)
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) {
    isDragTarget.value = false
  }
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  isDragTarget.value = false
  const groupId = event.dataTransfer?.getData('application/x-dm-group-id')
  if (!groupId) return
  if (groupId === dmGroupId.value) return
  dmTabsStore.setSplit(groupId)
}

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
  const content = expandShortcodes(messageInput.value.trim())
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
            <!-- Mute toggle -->
            <button
              v-if="dmGroupId && authStore.user?.id"
              @click="setMute(authStore.user.id, dmGroupId, !isMuted(dmGroupId))"
              :class="isMuted(dmGroupId) ? 'text-text-muted hover:text-text-primary' : 'text-text-primary hover:text-text-muted'"
              class="rounded p-1.5 hover:bg-bg-hover transition-colors"
              :title="isMuted(dmGroupId) ? 'Unmute notifications' : 'Mute notifications'"
            >
              <!-- Bell icon (not muted) -->
              <svg v-if="!isMuted(dmGroupId)" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <!-- Bell-off icon (muted) -->
              <svg v-else class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
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

    <!-- Split view: two conversation panes side by side -->
    <div
      v-if="dmTabsStore.splitGroupId"
      class="flex h-full overflow-hidden"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <DmConversationPane
        v-if="dmGroupId"
        :group-id="dmGroupId"
        class="flex-1 min-w-0"
      />
      <div v-else class="flex flex-1 items-center justify-center text-text-muted text-sm">
        Select a conversation
      </div>
      <div class="w-px flex-shrink-0 bg-bg-tertiary" />
      <DmConversationPane
        :group-id="dmTabsStore.splitGroupId"
        :secondary="true"
        class="flex-1 min-w-0"
      />
    </div>

    <!-- Normal view (no split) -->
    <template v-else>

    <!-- Drop zone overlay (drag target) -->
    <div
      v-if="isDragTarget"
      class="absolute inset-0 z-10 flex items-center justify-center bg-accent/10 pointer-events-none"
    >
      <div class="rounded-lg border-2 border-dashed border-accent/60 px-6 py-3 bg-bg-secondary shadow">
        <p class="text-sm font-medium text-accent">Drop to open side-by-side</p>
      </div>
    </div>

    <!-- Message list or welcome screen -->
    <div
      v-if="!dmGroupId"
      class="flex h-full flex-col items-center justify-center p-8 text-center"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
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

    <div
      v-else
      ref="messageListEl"
      class="flex flex-1 flex-col overflow-y-auto px-4 py-4"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
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
        <MessageBubble
          v-for="msg in groupedMessages"
          :key="msg.id"
          :message="msg"
          :content-html="renderMessage(msg.content, null) + (msg.edited_at ? ' <span class=\'text-xs text-text-muted\'>(edited)</span>' : '')"
          :reply-author-name="msg.reply_to_id && getDmMessageById(msg.reply_to_id) ? (getDmMessageById(msg.reply_to_id)!.profile.display_name ?? 'Unknown') : null"
          :reply-content="msg.reply_to_id && getDmMessageById(msg.reply_to_id) ? getDmMessageById(msg.reply_to_id)!.content : null"
          :is-editing="editingId === msg.id"
          :edit-content="editingContent"
          :is-author="msg.author_id === authStore.user?.id"
          :show-reaction-button="false"
          :show-pin-button="false"
          @update:edit-content="editingContent = $event"
          @reply="startReply(msg)"
          @start-edit="startEdit(msg)"
          @delete="handleDelete(msg.id)"
          @cancel-edit="cancelEdit"
          @submit-edit="submitEdit"
          @contextmenu="onDmMessageContext($event, msg)"
        />
      </div>
    </div>

    </template><!-- end normal view (no split) -->

    <template v-if="dmGroupId && !dmTabsStore.splitGroupId" #input>
      <MessageInputArea
        v-model="messageInput"
        :reply-display-name="replyingTo?.profile.display_name ?? null"
        :reply-content="replyingTo?.content ?? null"
        :typing-users="displayTypingUsers"
        :placeholder="`Message ${activeGroup?.otherUser.display_name ?? ''}`"
        :show-attach-button="false"
        :show-poll-button="false"
        :sending="sending"
        @submit="handleSend"
        @input="handleInput"
        @cancel-reply="cancelReply"
      />
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

      <div v-else class="flex h-full flex-col">
        <!-- Show other user's profile when a DM is active -->
        <div v-if="activeGroup" class="flex-1 p-4">
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
        <div v-else class="flex-1" />

        <!-- Members directory link -->
        <div class="border-t border-bg-tertiary p-3">
          <router-link
            to="/community/members"
            class="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
            :class="route.path === '/community/members' ? 'bg-bg-hover text-text-primary font-medium' : ''"
          >
            <svg class="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span>Members Directory</span>
          </router-link>
        </div>
      </div>
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
