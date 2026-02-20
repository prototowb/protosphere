<script setup lang="ts">
import { ref, watch, onMounted, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '@/components/layout/AppShell.vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
import { useServersStore } from '@/stores/servers'
import { useChannelsStore } from '@/stores/channels'
import { useMessagesStore } from '@/stores/messages'
import { useChannels } from '@/composables/useChannels'
import { useMembers } from '@/composables/useMembers'
import { useServers } from '@/composables/useServers'
import { useMessages } from '@/composables/useMessages'
import { useAuthStore } from '@/stores/auth'
import type { Message, Profile } from '@/lib/types'

const route = useRoute()
const router = useRouter()
const serversStore = useServersStore()
const channelsStore = useChannelsStore()
const messagesStore = useMessagesStore()
const authStore = useAuthStore()
const { fetchChannels, createChannel } = useChannels()
const { members, fetchMembers } = useMembers()
const { leaveServer, deleteServer, regenerateInviteCode } = useServers()
const { fetchMessages, sendMessage, editMessage, deleteMessage } = useMessages()

const showCreateChannel = ref(false)
const newChannelName = ref('')
const inviteCode = ref('')
const showInvite = ref(false)
const showServerActions = ref(false)

const serverId = ref('')
const channelId = ref('')

const messageInput = ref('')
const sending = ref(false)
const messageListEl = ref<HTMLElement | null>(null)

const editingId = ref<string | null>(null)
const editingContent = ref('')

const replyingTo = ref<(Message & { profile: Profile }) | null>(null)

function loadServer() {
  serverId.value = route.params.serverId as string
  channelId.value = route.params.channelId as string
  serversStore.activeServerId = serverId.value

  if (serverId.value) {
    fetchChannels(serverId.value)
    fetchMembers(serverId.value)
  }
}

onMounted(loadServer)
watch(() => route.params.serverId, loadServer)

watch(() => channelsStore.channels, (channels) => {
  if (channels.length > 0 && channelId.value === serverId.value) {
    const defaultChannel = channels.find((c) => c.is_default) || channels[0]
    if (defaultChannel) {
      channelsStore.activeChannelId = defaultChannel.id
      router.replace(`/channels/${serverId.value}/${defaultChannel.id}`)
    }
  } else {
    channelsStore.activeChannelId = channelId.value
  }
})

watch(() => route.params.channelId, (id) => {
  if (id && id !== serverId.value) {
    channelId.value = id as string
    channelsStore.activeChannelId = channelId.value
  }
})

// Load messages when active channel changes
watch(() => channelsStore.activeChannelId, (id) => {
  if (id && id !== serverId.value) {
    fetchMessages(id).then(() => scrollToBottom())
  }
}, { immediate: true })

const currentServer = ref<typeof serversStore.servers[0] | undefined>()
watch(
  [() => serversStore.servers, () => serverId.value],
  () => {
    currentServer.value = serversStore.servers.find((s) => s.id === serverId.value)
    if (currentServer.value) {
      inviteCode.value = currentServer.value.invite_code ?? ''
    }
  },
  { immediate: true },
)

const activeChannel = ref<typeof channelsStore.channels[0] | undefined>()
watch(
  [() => channelsStore.channels, () => channelsStore.activeChannelId],
  () => {
    activeChannel.value = channelsStore.channels.find((c) => c.id === channelsStore.activeChannelId)
  },
  { immediate: true },
)

const isOwner = ref(false)
watch(
  [() => currentServer.value, () => authStore.user],
  () => {
    isOwner.value = currentServer.value?.owner_id === authStore.user?.id
  },
  { immediate: true },
)

const messages = computed((): (Message & { profile: Profile })[] => {
  const id = channelsStore.activeChannelId
  return id ? (messagesStore.messagesByChannel[id] ?? []) as (Message & { profile: Profile })[] : []
})

function scrollToBottom() {
  nextTick(() => {
    if (messageListEl.value) {
      messageListEl.value.scrollTop = messageListEl.value.scrollHeight
    }
  })
}

watch(messages, scrollToBottom)

async function handleSendMessage() {
  const content = messageInput.value.trim()
  if (!content || sending.value || !channelsStore.activeChannelId || !authStore.user?.id) return
  sending.value = true
  try {
    messageInput.value = ''
    await sendMessage(channelsStore.activeChannelId, authStore.user.id, content, replyingTo.value?.id)
    replyingTo.value = null
  } finally {
    sending.value = false
  }
}

function getMessageById(id: string | null): (Message & { profile: Profile }) | null {
  if (!id) return null
  return messages.value.find((m) => m.id === id) ?? null
}

function startReply(msg: Message & { profile: Profile }) {
  replyingTo.value = msg
  editingId.value = null
}

function startEdit(msg: Message & { profile: Profile }) {
  editingId.value = msg.id
  editingContent.value = msg.content
}

function cancelEdit() {
  editingId.value = null
  editingContent.value = ''
}

async function submitEdit() {
  if (!editingId.value || !editingContent.value.trim() || !channelsStore.activeChannelId) return
  await editMessage(channelsStore.activeChannelId, editingId.value, editingContent.value.trim())
  cancelEdit()
}

async function handleDeleteMessage(messageId: string) {
  if (!channelsStore.activeChannelId) return
  await deleteMessage(channelsStore.activeChannelId, messageId)
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

// Group messages: collapse consecutive messages from same author within 5 minutes
type GroupedMessage = (Message & { profile: Profile }) & { showHeader: boolean; dateSeparator: string | null }

const groupedMessages = computed((): GroupedMessage[] => {
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

async function handleCreateChannel() {
  if (!newChannelName.value.trim() || !serverId.value) return
  await createChannel(serverId.value, newChannelName.value.trim())
  newChannelName.value = ''
  showCreateChannel.value = false
}

async function handleLeaveServer() {
  await leaveServer(serverId.value)
  router.push('/channels/@me')
}

async function handleDeleteServer() {
  if (!confirm('Are you sure you want to delete this server? This cannot be undone.')) return
  await deleteServer(serverId.value)
  router.push('/channels/@me')
}

async function handleRegenerateInvite() {
  inviteCode.value = await regenerateInviteCode(serverId.value)
}

function copyInviteCode() {
  navigator.clipboard.writeText(inviteCode.value)
}
</script>

<template>
  <AppShell>
    <template #sidebar-header>
      <div class="flex h-12 items-center justify-between border-b border-bg-tertiary px-4">
        <h2 class="truncate font-semibold">{{ currentServer?.name ?? 'Server' }}</h2>
        <div class="relative">
          <button
            @click="showServerActions = !showServerActions"
            class="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
            </svg>
          </button>

          <div
            v-if="showServerActions"
            class="absolute right-0 top-8 z-40 w-48 rounded-lg bg-bg-primary p-1 shadow-lg"
          >
            <button
              @click="showInvite = true; showServerActions = false"
              class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-text-primary hover:bg-bg-hover"
            >
              Invite People
            </button>
            <button
              @click="showCreateChannel = true; showServerActions = false"
              class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-text-primary hover:bg-bg-hover"
            >
              Create Channel
            </button>
            <template v-if="isOwner">
              <button
                @click="router.push(`/servers/${serverId}/settings`); showServerActions = false"
                class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-text-primary hover:bg-bg-hover"
              >
                Server Settings
              </button>
              <div class="my-1 h-px bg-bg-tertiary" />
              <button
                @click="handleDeleteServer(); showServerActions = false"
                class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-danger hover:bg-danger/10"
              >
                Delete Server
              </button>
            </template>
            <template v-else>
              <div class="my-1 h-px bg-bg-tertiary" />
              <button
                @click="handleLeaveServer(); showServerActions = false"
                class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-danger hover:bg-danger/10"
              >
                Leave Server
              </button>
            </template>
          </div>

          <div v-if="showServerActions" class="fixed inset-0 z-30" @click="showServerActions = false" />
        </div>
      </div>
    </template>

    <template #sidebar-content>
      <div class="space-y-0.5">
        <router-link
          v-for="channel in channelsStore.channels"
          :key="channel.id"
          :to="`/channels/${serverId}/${channel.id}`"
          class="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-sm hover:bg-bg-hover"
          :class="channelsStore.activeChannelId === channel.id ? 'bg-bg-hover text-text-primary font-medium' : 'text-text-secondary'"
        >
          <span class="text-text-muted">#</span>
          <span class="truncate">{{ channel.name }}</span>
        </router-link>
      </div>
    </template>

    <template #top-bar>
      <header class="flex h-12 items-center gap-2 border-b border-bg-tertiary bg-bg-primary px-4">
        <span class="text-text-muted">#</span>
        <span class="font-semibold text-text-primary">{{ activeChannel?.name ?? 'general' }}</span>
        <span v-if="activeChannel?.description" class="ml-2 truncate text-sm text-text-muted">
          {{ activeChannel.description }}
        </span>
      </header>
    </template>

    <!-- Message list -->
    <div ref="messageListEl" class="flex flex-1 flex-col overflow-y-auto px-4 py-4">
      <!-- Empty state -->
      <div v-if="messages.length === 0" class="flex flex-1 flex-col items-center justify-center py-16 text-center">
        <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-bg-tertiary">
          <span class="text-2xl text-text-muted">#</span>
        </div>
        <h2 class="mb-1 text-xl font-bold">Welcome to #{{ activeChannel?.name ?? 'general' }}</h2>
        <p class="max-w-md text-text-secondary">
          This is the start of the #{{ activeChannel?.name ?? 'general' }} channel.
          {{ activeChannel?.description || 'Send a message to get started!' }}
        </p>
      </div>

      <!-- Messages -->
      <div v-else class="flex flex-col gap-0.5">
        <template v-for="msg in groupedMessages" :key="msg.id">
          <!-- Date separator -->
          <div v-if="msg.dateSeparator" class="my-4 flex items-center gap-3">
            <div class="h-px flex-1 bg-bg-tertiary" />
            <span class="text-xs text-text-muted">{{ msg.dateSeparator }}</span>
            <div class="h-px flex-1 bg-bg-tertiary" />
          </div>

          <!-- Message row -->
          <div
            class="group relative flex gap-3 rounded px-2 py-0.5 hover:bg-bg-secondary"
            :class="msg.showHeader ? 'mt-3' : ''"
          >
            <!-- Avatar (only on first in group) -->
            <div class="w-10 flex-shrink-0">
              <UserAvatar
                v-if="msg.showHeader"
                :src="msg.profile.avatar_url"
                :alt="msg.profile.display_name"
                size="sm"
              />
            </div>

            <div class="min-w-0 flex-1">
              <!-- Reply quote -->
              <div
                v-if="msg.reply_to_id"
                class="mb-1 flex cursor-default items-center gap-1.5 text-xs text-text-muted"
              >
                <svg class="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
                </svg>
                <span class="font-medium text-text-secondary">{{ getMessageById(msg.reply_to_id)?.profile.display_name ?? 'Unknown' }}</span>
                <span class="truncate">{{ getMessageById(msg.reply_to_id)?.content ?? '[deleted]' }}</span>
              </div>

              <!-- Header (only on first in group) -->
              <div v-if="msg.showHeader" class="mb-0.5 flex items-baseline gap-2">
                <span class="font-semibold text-text-primary">{{ msg.profile.display_name }}</span>
                <span class="text-xs text-text-muted">{{ formatTime(msg.created_at) }}</span>
              </div>

              <!-- Edit mode -->
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

              <!-- Content -->
              <p v-else class="break-words text-sm text-text-primary leading-relaxed">
                {{ msg.content }}
                <span v-if="msg.edited_at" class="ml-1 text-xs text-text-muted">(edited)</span>
              </p>
            </div>

            <!-- Hover actions -->
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
                  <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
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
                v-if="msg.author_id === authStore.user?.id || isOwner"
                @click="handleDeleteMessage(msg.id)"
                class="rounded p-1 text-text-muted hover:bg-danger/10 hover:text-danger"
                title="Delete"
              >
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>

            <!-- Timestamp on hover (for collapsed messages) -->
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

    <template #input>
      <div class="px-4 pb-4">
        <!-- Reply bar -->
        <div
          v-if="replyingTo"
          class="mb-1 flex items-center gap-2 rounded-t-lg bg-bg-secondary px-4 py-2 text-xs text-text-muted"
        >
          <svg class="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
          </svg>
          <span>Replying to <span class="font-medium text-text-primary">{{ replyingTo.profile.display_name }}</span></span>
          <span class="flex-1 truncate text-text-muted">{{ replyingTo.content }}</span>
          <button @click="replyingTo = null" class="ml-auto flex-shrink-0 hover:text-text-primary">✕</button>
        </div>
        <form @submit.prevent="handleSendMessage" class="flex items-center gap-2 rounded-lg bg-bg-tertiary px-4 py-3" :class="replyingTo ? 'rounded-t-none' : ''">
          <input
            v-model="messageInput"
            type="text"
            :placeholder="`Message #${activeChannel?.name ?? 'general'}`"
            :disabled="!activeChannel"
            class="flex-1 bg-transparent text-text-primary placeholder-text-muted outline-none disabled:cursor-not-allowed"
            @keydown.enter.prevent="handleSendMessage"
          />
          <button
            type="submit"
            :disabled="!messageInput.trim() || sending || !activeChannel"
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
      <div class="p-4">
        <h3 class="mb-3 text-xs font-semibold uppercase text-text-muted">
          Members — {{ members.length }}
        </h3>
        <div class="space-y-1">
          <div
            v-for="member in members"
            :key="member.user_id"
            class="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-bg-hover"
          >
            <UserAvatar
              :src="member.profile.avatar_url"
              :alt="member.profile.display_name"
              :status="member.profile.status"
              size="sm"
            />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ member.profile.display_name }}</p>
              <p v-if="member.role !== 'member'" class="text-xs text-accent">{{ member.role }}</p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </AppShell>

  <!-- Create Channel Dialog -->
  <div v-if="showCreateChannel" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="showCreateChannel = false">
    <div class="w-full max-w-md rounded-lg bg-bg-secondary p-6">
      <h2 class="mb-4 text-xl font-bold">Create Channel</h2>
      <form @submit.prevent="handleCreateChannel" class="space-y-4">
        <div>
          <label for="channel-name" class="mb-1 block text-sm text-text-secondary">Channel Name</label>
          <input
            id="channel-name"
            v-model="newChannelName"
            type="text"
            required
            maxlength="50"
            class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
            placeholder="new-channel"
          />
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" @click="showCreateChannel = false" class="rounded px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Cancel</button>
          <button type="submit" :disabled="!newChannelName.trim()" class="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50">Create</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Invite Dialog -->
  <div v-if="showInvite" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="showInvite = false">
    <div class="w-full max-w-md rounded-lg bg-bg-secondary p-6">
      <h2 class="mb-4 text-xl font-bold">Invite People</h2>
      <p class="mb-2 text-sm text-text-secondary">Share this invite code with others:</p>
      <div class="flex items-center gap-2">
        <input
          :value="inviteCode"
          readonly
          class="flex-1 rounded border border-bg-tertiary bg-bg-primary px-3 py-2 font-mono text-text-primary"
        />
        <button @click="copyInviteCode" class="rounded bg-accent px-3 py-2 text-sm text-white hover:bg-accent-hover">Copy</button>
      </div>
      <button
        v-if="isOwner"
        @click="handleRegenerateInvite"
        class="mt-2 text-sm text-text-muted hover:text-text-primary"
      >
        Regenerate code
      </button>
      <div class="mt-4 flex justify-end">
        <button @click="showInvite = false" class="rounded px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Close</button>
      </div>
    </div>
  </div>
</template>
