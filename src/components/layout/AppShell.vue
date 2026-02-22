<script setup lang="ts">
import { onMounted, ref, watchEffect } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useServersStore } from '@/stores/servers'
import { useProfile } from '@/composables/useProfile'
import { useServers } from '@/composables/useServers'
import UserAvatar from '@/components/user/UserAvatar.vue'
import CreateServerDialog from '@/components/server/CreateServerDialog.vue'
import JoinServerDialog from '@/components/server/JoinServerDialog.vue'
import { usePresence } from '@/composables/usePresence'
import { useMentionsStore } from '@/stores/mentions'
import { useDmUnread } from '@/composables/useDmUnread'
import { useContextMenuStore } from '@/stores/contextMenu'
import { useToastStore } from '@/stores/toast'
import { serverIconContextItems, userBarContextItems } from '@/lib/contextMenuItems'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import type { UserStatus } from '@/lib/types'

const router = useRouter()
const route = useRoute()
const ui = useUiStore()
const authStore = useAuthStore()
const serversStore = useServersStore()
const { profile, fetchProfile } = useProfile()
const { fetchServers, createServer, joinServer } = useServers()

const { currentStatus, setManualStatus } = usePresence()
const mentionsStore = useMentionsStore()
const { totalDmUnread } = useDmUnread()
const contextMenuStore = useContextMenuStore()
const toastStore = useToastStore()

// Tab title with unread count
watchEffect(() => {
  const serverMentions = Object.values(mentionsStore.mentionsByServer).reduce((a, b) => a + (b ?? 0), 0)
  const total = serverMentions + totalDmUnread.value
  document.title = total > 0 ? `(${total}) Protosphere` : 'Protosphere'
})

const showCreateServer = ref(false)
const showJoinServer = ref(false)
const showServerMenu = ref(false)
const serverError = ref('')

// Status picker
const showStatusPicker = ref(false)
const STATUS_OPTIONS: { status: UserStatus; label: string; color: string }[] = [
  { status: 'online', label: 'Online', color: 'bg-presence-online' },
  { status: 'idle', label: 'Idle', color: 'bg-presence-idle' },
  { status: 'dnd', label: 'Do Not Disturb', color: 'bg-presence-dnd' },
  { status: 'offline', label: 'Invisible', color: 'bg-presence-offline' },
]

function handleSetManualStatus(status: UserStatus) {
  setManualStatus(status)
  showStatusPicker.value = false
}

// Confirm dialog for destructive server icon actions
const confirmDialog = ref<{
  title: string
  message: string
  confirmLabel: string
  danger: boolean
  requireInput?: string
  inputPlaceholder?: string
  onConfirm: (input: string) => void
} | null>(null)

function onUserBarContext(event: MouseEvent) {
  contextMenuStore.show(event, userBarContextItems({
    onSetStatus: (status: UserStatus) => setManualStatus(status),
    onCopyUsername: () => {
      if (profile.value?.username) {
        navigator.clipboard.writeText(profile.value.username)
        toastStore.show('Username copied!', 'success')
      }
    },
    onSettings: () => router.push('/settings'),
  }))
}

onMounted(() => {
  if (authStore.user?.id) {
    fetchProfile()
    fetchServers()
  }
})

async function handleCreateServer(name: string, description: string) {
  serverError.value = ''
  try {
    const server = await createServer(name, description)
    showCreateServer.value = false
    if (server) {
      router.push(`/channels/${server.id}/${server.id}`)
    }
  } catch (e: unknown) {
    serverError.value = e instanceof Error ? e.message : 'Failed to create server'
  }
}

async function handleJoinServer(inviteCode: string, done: (error?: string) => void) {
  serverError.value = ''
  try {
    const server = await joinServer(inviteCode)
    done()
    showJoinServer.value = false
    if (server) {
      router.push(`/channels/${server.id}/${server.id}`)
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to join server'
    serverError.value = msg
    done(msg)
  }
}

const showInviteDialog = ref(false)
const inviteDialogCode = ref('')
const inviteDialogServerId = ref('')
const inviteDialogIsOwner = ref(false)

function onServerIconContext(event: MouseEvent, server: typeof serversStore.servers[0]) {
  const isOwner = server.owner_id === authStore.user?.id
  contextMenuStore.show(event, serverIconContextItems({
    isOwner,
    onInvite: () => {
      inviteDialogCode.value = server.invite_code ?? ''
      inviteDialogServerId.value = server.id
      inviteDialogIsOwner.value = isOwner
      showInviteDialog.value = true
    },
    onServerSettings: () => router.push(`/servers/${server.id}/settings`),
    onMarkRead: () => {
      mentionsStore.mentionsByServer[server.id] = 0
      toastStore.show('Marked as read', 'info')
    },
    onLeave: () => {
      confirmDialog.value = {
        title: 'Leave Server',
        message: `Are you sure you want to leave "${server.name}"?`,
        confirmLabel: 'Leave',
        danger: true,
        onConfirm: async () => {
          confirmDialog.value = null
          const { leaveServer } = useServers()
          await leaveServer(server.id)
          toastStore.show('Left server', 'success')
          router.push('/channels/@me')
        },
      }
    },
    onDelete: () => {
      confirmDialog.value = {
        title: 'Delete Server',
        message: `This will permanently delete "${server.name}" and all its channels and messages. Type the server name to confirm.`,
        confirmLabel: 'Delete Server',
        danger: true,
        requireInput: server.name,
        onConfirm: async () => {
          confirmDialog.value = null
          const { deleteServer } = useServers()
          await deleteServer(server.id)
          toastStore.show('Server deleted', 'success')
          router.push('/channels/@me')
        },
      }
    },
  }))
}

function copyInviteCode() {
  navigator.clipboard.writeText(inviteDialogCode.value)
  toastStore.show('Invite code copied!', 'success')
}

async function handleRegenerateInvite() {
  const { regenerateInviteCode } = useServers()
  inviteDialogCode.value = await regenerateInviteCode(inviteDialogServerId.value)
}

function getServerInitial(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()
}
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <!-- Server Sidebar -->
    <aside
      v-if="ui.serverSidebarOpen"
      class="flex w-18 flex-col items-center bg-bg-primary"
    >
      <div class="flex flex-1 flex-col items-center gap-2 overflow-y-auto py-3">
        <!-- DM / Home Button -->
        <div class="relative">
          <router-link
            to="/channels/@me"
            class="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-sm font-bold text-white transition-all hover:rounded-xl"
            :class="{ 'rounded-xl': route.path.startsWith('/channels/@me') }"
            title="Direct Messages"
          >
            <svg class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            </svg>
          </router-link>
          <span
            v-if="totalDmUnread > 0"
            class="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white"
          >
            {{ totalDmUnread > 99 ? '99+' : totalDmUnread }}
          </span>
        </div>

        <div class="my-1 h-px w-8 bg-bg-tertiary" />

        <!-- Server list -->
        <div v-for="server in serversStore.servers" :key="server.id" class="relative">
          <router-link
            :to="`/channels/${server.id}/${server.id}`"
            class="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-bg-tertiary text-xs font-bold text-text-primary transition-all hover:rounded-xl hover:bg-accent"
            :class="{ 'rounded-xl bg-accent': serversStore.activeServerId === server.id }"
            :title="server.name"
            @contextmenu.prevent="onServerIconContext($event, server)"
          >
            <img
              v-if="server.icon_url"
              :src="server.icon_url"
              :alt="server.name"
              class="h-full w-full object-cover"
            />
            <span v-else>{{ getServerInitial(server.name) }}</span>
          </router-link>
          <!-- Mention badge -->
          <span
            v-if="mentionsStore.mentionsByServer[server.id]"
            class="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white"
          >
            {{ (mentionsStore.mentionsByServer[server.id] ?? 0) > 99 ? '99+' : mentionsStore.mentionsByServer[server.id] }}
          </span>
        </div>
      </div>

      <!-- Add server button (outside scroll container so dropdown isn't clipped) -->
      <div class="relative mb-2 flex-shrink-0">
        <button
          @click="showServerMenu = !showServerMenu"
          class="flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-tertiary text-xl text-text-muted transition-all hover:rounded-xl hover:bg-accent hover:text-white"
          title="Add a Server"
        >
          +
        </button>

        <!-- Add server dropdown -->
        <div
          v-if="showServerMenu"
          class="absolute bottom-0 left-14 z-40 w-48 rounded-lg bg-bg-secondary p-1 shadow-lg"
        >
          <button
            @click="showCreateServer = true; showServerMenu = false"
            class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-text-primary hover:bg-bg-hover"
          >
            Create Server
          </button>
          <button
            @click="showJoinServer = true; showServerMenu = false"
            class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-text-primary hover:bg-bg-hover"
          >
            Join Server
          </button>
        </div>
      </div>

    </aside>

    <!-- Channel Sidebar -->
    <aside
      v-if="ui.channelSidebarOpen"
      class="flex w-60 flex-col bg-bg-secondary"
    >
      <slot name="sidebar-header">
        <div class="flex h-12 items-center border-b border-bg-tertiary px-4">
          <h2 class="truncate font-semibold">Direct Messages</h2>
        </div>
      </slot>

      <nav class="flex-1 overflow-y-auto p-2">
        <slot name="sidebar-content">
          <p class="px-2 py-4 text-center text-sm text-text-muted">No conversations yet</p>
        </slot>
      </nav>

      <!-- User info bar -->
      <div class="relative flex items-center gap-2 border-t border-bg-tertiary px-3 py-2" @contextmenu.prevent="onUserBarContext($event)">
        <button
          @click="showStatusPicker = !showStatusPicker"
          class="flex-shrink-0"
          title="Set status"
        >
          <UserAvatar
            :src="profile?.avatar_url"
            :alt="profile?.display_name ?? '?'"
            :status="currentStatus"
            size="sm"
          />
        </button>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">{{ profile?.display_name ?? authStore.user?.email ?? 'User' }}</p>
          <p v-if="profile?.status_text" class="truncate text-xs text-text-muted">{{ profile.status_text }}</p>
        </div>
        <button
          @click="router.push('/settings')"
          class="flex-shrink-0 rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary"
          title="User Settings"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>

        <!-- Status picker popover -->
        <div
          v-if="showStatusPicker"
          class="absolute bottom-full left-0 z-40 mb-2 w-48 rounded-lg bg-bg-primary p-1 shadow-lg"
        >
          <button
            v-for="opt in STATUS_OPTIONS"
            :key="opt.status"
            @click="handleSetManualStatus(opt.status)"
            class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-text-primary hover:bg-bg-hover"
          >
            <span class="h-2.5 w-2.5 rounded-full" :class="opt.color" />
            {{ opt.label }}
          </button>
        </div>
        <div v-if="showStatusPicker" class="fixed inset-0 z-30" @click="showStatusPicker = false" />
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex flex-1 flex-col">
      <slot name="top-bar">
        <header class="flex h-12 items-center border-b border-bg-tertiary bg-bg-primary px-4">
          <span class="text-text-secondary">Home</span>
        </header>
      </slot>

      <div class="flex-1 overflow-y-auto">
        <slot>
          <div class="flex h-full items-center justify-center p-4">
            <p class="text-text-muted">Select a conversation to start chatting</p>
          </div>
        </slot>
      </div>

      <slot name="input" />
    </main>

    <!-- Member Sidebar -->
    <aside
      v-if="ui.memberSidebarOpen"
      class="w-60 overflow-y-auto bg-bg-secondary"
    >
      <slot name="members">
        <div class="p-4">
          <h3 class="mb-2 text-xs font-semibold uppercase text-text-muted">Members</h3>
          <p class="text-sm text-text-secondary">Member list will go here.</p>
        </div>
      </slot>
    </aside>

    <!-- Dialogs -->
    <CreateServerDialog
      v-if="showCreateServer"
      @create="handleCreateServer"
      @close="showCreateServer = false"
    />
    <JoinServerDialog
      v-if="showJoinServer"
      @join="handleJoinServer"
      @close="showJoinServer = false"
    />

    <!-- Invite dialog (from server icon context menu) -->
    <div v-if="showInviteDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="showInviteDialog = false">
      <div class="w-full max-w-md rounded-lg bg-bg-secondary p-6">
        <h2 class="mb-4 text-xl font-bold">Invite People</h2>
        <p class="mb-2 text-sm text-text-secondary">Share this invite code with others:</p>
        <div class="flex items-center gap-2">
          <input
            :value="inviteDialogCode"
            readonly
            class="flex-1 rounded border border-bg-tertiary bg-bg-primary px-3 py-2 font-mono text-text-primary"
          />
          <button @click="copyInviteCode" class="rounded bg-accent px-3 py-2 text-sm text-white hover:bg-accent-hover">Copy</button>
        </div>
        <button
          v-if="inviteDialogIsOwner"
          @click="handleRegenerateInvite"
          class="mt-2 text-sm text-text-muted hover:text-text-primary"
        >
          Regenerate code
        </button>
        <div class="mt-4 flex justify-end">
          <button @click="showInviteDialog = false" class="rounded px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Close</button>
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
      :require-input="confirmDialog.requireInput"
      :input-placeholder="confirmDialog.inputPlaceholder"
      @confirm="confirmDialog.onConfirm"
      @cancel="confirmDialog = null"
    />

    <!-- Close server menu on outside click -->
    <div
      v-if="showServerMenu"
      class="fixed inset-0 z-30"
      @click="showServerMenu = false"
    />
  </div>
</template>
