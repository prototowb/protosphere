<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useDmsStore } from '@/stores/dms'
import { useDmTabsStore } from '@/stores/dmTabs'
import { useDMs } from '@/composables/useDMs'
import { useToastStore } from '@/stores/toast'
import { useContextMenuStore } from '@/stores/contextMenu'
import { renderMessage } from '@/lib/mentions'
import { expandShortcodes } from '@/lib/emojiNames'
import { formatDate } from '@/lib/formatters'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import MessageInputArea from '@/components/chat/MessageInputArea.vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { dmMessageContextItems } from '@/lib/contextMenuItems'
import type { DirectMessage, Profile } from '@/lib/types'

const props = defineProps<{
  groupId: string
  /** True when rendered as the secondary (split) pane — shows close button. */
  secondary?: boolean
}>()

const authStore = useAuthStore()
const store = useDmsStore()
const dmTabsStore = useDmTabsStore()
const toastStore = useToastStore()
const contextMenuStore = useContextMenuStore()
const { fetchMessages, sendMessage, editMessage, deleteMessage } = useDMs()

const messageInput = ref('')
const sending = ref(false)
const messageListEl = ref<HTMLElement | null>(null)
const editingId = ref<string | null>(null)
const editingContent = ref('')
const replyingTo = ref<(DirectMessage & { profile: Profile }) | null>(null)
const confirmDialog = ref<{
  title: string
  message: string
  confirmLabel: string
  danger: boolean
  onConfirm: (input: string) => void
} | null>(null)

const activeGroup = computed(() => store.groups.find((g) => g.id === props.groupId))

const messages = computed(() =>
  (store.messagesByGroup[props.groupId] ?? []) as (DirectMessage & { profile: Profile })[],
)

type GroupedDM = DirectMessage & {
  profile: Profile
  showHeader: boolean
  dateSeparator: string | null
}

const groupedMessages = computed((): GroupedDM[] =>
  messages.value.map((msg, i) => {
    const prev = messages.value[i - 1]
    const sameAuthor = prev && prev.author_id === msg.author_id
    const withinWindow =
      prev &&
      new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000
    const showHeader = !sameAuthor || !withinWindow
    const currDate = new Date(msg.created_at).toDateString()
    const prevDate = prev ? new Date(prev.created_at).toDateString() : null
    const dateSeparator = currDate !== prevDate ? formatDate(msg.created_at) : null
    return { ...msg, showHeader, dateSeparator }
  }),
)

function getDmMessageById(id: string) {
  return messages.value.find((m) => m.id === id)
}

watch(
  () => props.groupId,
  (id) => {
    if (!id) return
    editingId.value = null
    editingContent.value = ''
    replyingTo.value = null
    messageInput.value = ''
    if (!store.messagesByGroup[id] || store.messagesByGroup[id].length === 0) {
      fetchMessages(id).then(() => scrollToBottom())
    } else {
      scrollToBottom()
    }
  },
  { immediate: true },
)

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
  if (!content || sending.value) return
  sending.value = true
  const replyId = replyingTo.value?.id ?? null
  try {
    messageInput.value = ''
    replyingTo.value = null
    await sendMessage(props.groupId, content, replyId)
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
  if (!editingId.value || !editingContent.value.trim()) return
  await editMessage(props.groupId, editingId.value, editingContent.value.trim())
  cancelEdit()
}

function startReply(msg: DirectMessage & { profile: Profile }) {
  replyingTo.value = msg
}

function cancelReply() {
  replyingTo.value = null
}

function handleDelete(messageId: string) {
  confirmDialog.value = {
    title: 'Delete Message',
    message: 'Are you sure you want to delete this message? This cannot be undone.',
    confirmLabel: 'Delete',
    danger: true,
    onConfirm: async () => {
      confirmDialog.value = null
      await deleteMessage(props.groupId, messageId)
    },
  }
}

function onMessageContext(event: MouseEvent, msg: DirectMessage & { profile: Profile }) {
  const isAuthor = msg.author_id === authStore.user?.id
  contextMenuStore.show(
    event,
    dmMessageContextItems({
      isAuthor,
      onReply: () => startReply(msg),
      onEdit: () => startEdit(msg),
      onDelete: () => handleDelete(msg.id),
      onCopyText: () => {
        navigator.clipboard.writeText(msg.content)
        toastStore.show('Copied to clipboard', 'success')
      },
    }),
  )
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden">
    <!-- Pane header -->
    <div class="flex h-10 flex-shrink-0 items-center gap-2 border-b border-bg-tertiary bg-bg-primary px-3">
      <UserAvatar
        v-if="activeGroup"
        :src="activeGroup.otherUser.avatar_url"
        :alt="activeGroup.otherUser.display_name"
        :status="activeGroup.otherUser.status"
        size="sm"
      />
      <span class="flex-1 truncate text-sm font-semibold text-text-primary">
        {{ activeGroup?.otherUser.display_name ?? '…' }}
      </span>
      <button
        v-if="secondary"
        @click="dmTabsStore.setSplit(null)"
        class="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
        title="Close split pane"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <!-- Message list -->
    <div ref="messageListEl" class="flex flex-1 flex-col overflow-y-auto px-4 py-4">
      <div
        v-if="messages.length === 0"
        class="flex flex-1 flex-col items-center justify-center py-16 text-center"
      >
        <UserAvatar
          v-if="activeGroup"
          :src="activeGroup.otherUser.avatar_url"
          :alt="activeGroup.otherUser.display_name"
          size="lg"
        />
        <h2 class="mt-4 text-lg font-bold">{{ activeGroup?.otherUser.display_name }}</h2>
        <p class="mt-1 text-sm text-text-secondary">
          Beginning of your conversation with {{ activeGroup?.otherUser.display_name }}.
        </p>
      </div>

      <div v-else class="flex flex-col gap-0.5">
        <MessageBubble
          v-for="msg in groupedMessages"
          :key="msg.id"
          :message="msg"
          :content-html="
            renderMessage(msg.content, null) +
            (msg.edited_at ? ' <span class=\'text-xs text-text-muted\'>(edited)</span>' : '')
          "
          :reply-author-name="
            msg.reply_to_id && getDmMessageById(msg.reply_to_id)
              ? (getDmMessageById(msg.reply_to_id)!.profile.display_name ?? 'Unknown')
              : null
          "
          :reply-content="
            msg.reply_to_id && getDmMessageById(msg.reply_to_id)
              ? getDmMessageById(msg.reply_to_id)!.content
              : null
          "
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
          @contextmenu="onMessageContext($event, msg)"
        />
      </div>
    </div>

    <!-- Input area -->
    <MessageInputArea
      v-model="messageInput"
      :reply-display-name="replyingTo?.profile.display_name ?? null"
      :reply-content="replyingTo?.content ?? null"
      :typing-users="[]"
      :placeholder="`Message ${activeGroup?.otherUser.display_name ?? ''}`"
      :show-attach-button="false"
      :show-poll-button="false"
      :sending="sending"
      @submit="handleSend"
      @cancel-reply="cancelReply"
    />

    <ConfirmDialog
      v-if="confirmDialog"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      :confirm-label="confirmDialog.confirmLabel"
      :danger="confirmDialog.danger"
      @confirm="confirmDialog.onConfirm"
      @cancel="confirmDialog = null"
    />
  </div>
</template>
