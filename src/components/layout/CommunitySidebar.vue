<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useServersStore } from '@/stores/servers'
import { useCommunityStore } from '@/stores/community'
import { useMentionsStore } from '@/stores/mentions'
import { useDmUnread } from '@/composables/useDmUnread'
import { useServers } from '@/composables/useServers'
import { useCommunity } from '@/composables/useCommunity'
import { useContextMenuStore } from '@/stores/contextMenu'
import { useToastStore } from '@/stores/toast'
import { serverIconContextItems } from '@/lib/contextMenuItems'
import CreateServerDialog from '@/components/server/CreateServerDialog.vue'
import JoinServerDialog from '@/components/server/JoinServerDialog.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import type { SpaceVisibility } from '@/lib/types'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const serversStore = useServersStore()
const communityStore = useCommunityStore()
const mentionsStore = useMentionsStore()
const { totalDmUnread } = useDmUnread()
const { createServer, joinServer, leaveServer, deleteServer, regenerateInviteCode } = useServers()
const { fetchCommunity } = useCommunity()
const contextMenuStore = useContextMenuStore()
const toastStore = useToastStore()

onMounted(() => {
  fetchCommunity()
})

// Community identity
const community = computed(() => communityStore.settings)
function getCommunityInitial(name: string) {
  return name.split(/\s+/).map((w) => w[0]).join('').substring(0, 2).toUpperCase()
}

// Space helpers
const spaces = computed(() => [...serversStore.servers].sort((a, b) => a.sort_order - b.sort_order))

const VISIBILITY_ICON: Record<SpaceVisibility, string> = {
  public: '🌐',
  restricted: '🔒',
  private: '👁',
}

function getSpaceInitial(name: string) {
  return name.split(/\s+/).map((w) => w[0]).join('').substring(0, 2).toUpperCase()
}

// Whether the current user owns any space (used as proxy for community admin access)
const isAnyOwner = computed(() =>
  serversStore.servers.some((s) => s.owner_id === authStore.user?.id),
)

// Create / Join dialogs
const showCreateSpace = ref(false)
const showJoinSpace = ref(false)
const showAddMenu = ref(false)

async function handleCreateSpace(name: string, description: string, visibility: SpaceVisibility) {
  try {
    const server = await createServer(name, description, visibility)
    showCreateSpace.value = false
    if (server) router.push(`/channels/${server.id}/${server.id}`)
  } catch (e: unknown) {
    toastStore.show(e instanceof Error ? e.message : 'Failed to create space', 'error')
    showCreateSpace.value = false
  }
}

async function handleJoinSpace(inviteCode: string, done: (error?: string) => void) {
  try {
    const server = await joinServer(inviteCode)
    done()
    showJoinSpace.value = false
    if (server) router.push(`/channels/${server.id}/${server.id}`)
  } catch (e: unknown) {
    done(e instanceof Error ? e.message : 'Failed to join space')
  }
}

// Space context menu
const confirmDialog = ref<{
  title: string
  message: string
  confirmLabel: string
  danger: boolean
  requireInput?: string
  inputPlaceholder?: string
  onConfirm: (input: string) => void
} | null>(null)

const inviteDialog = ref<{ code: string; serverId: string; isOwner: boolean } | null>(null)

function onSpaceContext(event: MouseEvent, server: typeof serversStore.servers[0]) {
  const isOwner = server.owner_id === authStore.user?.id
  contextMenuStore.show(event, serverIconContextItems({
    isOwner,
    onInvite: () => {
      inviteDialog.value = { code: server.invite_code ?? '', serverId: server.id, isOwner }
    },
    onServerSettings: () => router.push(`/servers/${server.id}/settings`),
    onMarkRead: () => {
      mentionsStore.mentionsByServer[server.id] = 0
      toastStore.show('Marked as read', 'info')
    },
    onLeave: () => {
      confirmDialog.value = {
        title: 'Leave Space',
        message: `Are you sure you want to leave "${server.name}"?`,
        confirmLabel: 'Leave',
        danger: true,
        onConfirm: async () => {
          confirmDialog.value = null
          await leaveServer(server.id)
          toastStore.show('Left space', 'success')
          router.push('/channels/@me')
        },
      }
    },
    onDelete: () => {
      confirmDialog.value = {
        title: 'Delete Space',
        message: `This will permanently delete "${server.name}" and all its channels and messages. Type the space name to confirm.`,
        confirmLabel: 'Delete Space',
        danger: true,
        requireInput: server.name,
        onConfirm: async () => {
          confirmDialog.value = null
          await deleteServer(server.id)
          toastStore.show('Space deleted', 'success')
          router.push('/channels/@me')
        },
      }
    },
  }))
}

async function handleRegenerateInvite() {
  if (!inviteDialog.value) return
  inviteDialog.value.code = await regenerateInviteCode(inviteDialog.value.serverId)
}

function copyInviteCode() {
  if (!inviteDialog.value) return
  navigator.clipboard.writeText(inviteDialog.value.code)
  toastStore.show('Invite code copied!', 'success')
}
</script>

<template>
  <aside class="flex w-60 flex-col bg-bg-secondary">
    <!-- Community header -->
    <div
      class="flex h-14 flex-shrink-0 cursor-pointer items-center gap-3 border-b border-bg-tertiary px-4 hover:bg-bg-hover transition-colors"
      :class="isAnyOwner ? 'cursor-pointer' : 'cursor-default'"
      @click="isAnyOwner ? router.push('/admin/community') : undefined"
      :title="isAnyOwner ? 'Community Settings' : undefined"
    >
      <!-- Logo or initials -->
      <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-accent text-xs font-bold text-white">
        <img
          v-if="community?.logo_url"
          :src="community.logo_url"
          :alt="community.name"
          class="h-full w-full object-cover"
        />
        <span v-else>{{ getCommunityInitial(community?.name ?? 'PS') }}</span>
      </div>
      <span class="min-w-0 flex-1 truncate font-semibold">{{ community?.name ?? 'Community' }}</span>
      <svg v-if="isAnyOwner" class="h-3.5 w-3.5 flex-shrink-0 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>

    <!-- Sidebar body -->
    <nav class="flex-1 overflow-y-auto py-2">
      <!-- Direct Messages link -->
      <router-link
        to="/channels/@me"
        class="mx-2 mb-1 flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors"
        :class="route.path.startsWith('/channels/@me') ? 'bg-bg-hover text-text-primary font-medium' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'"
      >
        <svg class="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
        <span class="flex-1">Direct Messages</span>
        <span
          v-if="totalDmUnread > 0"
          class="flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white"
        >
          {{ totalDmUnread > 99 ? '99+' : totalDmUnread }}
        </span>
      </router-link>

      <div class="mx-2 my-1 h-px bg-bg-tertiary" />

      <!-- Spaces section header -->
      <div class="mb-1 flex items-center justify-between px-4 pt-1">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Spaces</span>
      </div>

      <!-- Space list -->
      <router-link
        v-for="space in spaces"
        :key="space.id"
        :to="`/channels/${space.id}/${space.id}`"
        class="mx-2 flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors"
        :class="serversStore.activeServerId === space.id ? 'bg-bg-hover text-text-primary font-medium' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'"
        @contextmenu.prevent="onSpaceContext($event, space)"
      >
        <!-- Space icon -->
        <div class="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-bg-tertiary text-[9px] font-bold">
          <img
            v-if="space.icon_url"
            :src="space.icon_url"
            :alt="space.name"
            class="h-full w-full object-cover"
          />
          <span v-else>{{ getSpaceInitial(space.name) }}</span>
        </div>

        <!-- Space name -->
        <span class="min-w-0 flex-1 truncate">{{ space.name }}</span>

        <!-- Visibility indicator (non-public spaces) -->
        <span
          v-if="space.visibility !== 'public'"
          class="flex-shrink-0 text-[11px]"
          :title="space.visibility"
        >{{ VISIBILITY_ICON[space.visibility] }}</span>

        <!-- Mention badge -->
        <span
          v-if="mentionsStore.mentionsByServer[space.id]"
          class="flex h-4 min-w-4 flex-shrink-0 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white"
        >
          {{ (mentionsStore.mentionsByServer[space.id] ?? 0) > 99 ? '99+' : mentionsStore.mentionsByServer[space.id] }}
        </span>
      </router-link>

      <!-- Empty state -->
      <p v-if="spaces.length === 0" class="px-4 py-3 text-xs text-text-muted">No spaces yet.</p>
    </nav>

    <!-- Bottom actions -->
    <div class="flex-shrink-0 border-t border-bg-tertiary p-2">
      <div class="relative">
        <button
          @click="showAddMenu = !showAddMenu"
          class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          <span class="text-base leading-none font-light">+</span>
          <span>Add a Space</span>
        </button>

        <div
          v-if="showAddMenu"
          class="absolute bottom-full left-0 right-0 mb-1 rounded-lg bg-bg-primary p-1 shadow-lg z-40"
        >
          <button
            @click="showCreateSpace = true; showAddMenu = false"
            class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-text-primary hover:bg-bg-hover"
          >
            Create Space
          </button>
          <button
            @click="showJoinSpace = true; showAddMenu = false"
            class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-text-primary hover:bg-bg-hover"
          >
            Join a Space
          </button>
        </div>
      </div>

      <router-link
        v-if="isAnyOwner"
        to="/admin/community"
        class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        Community Settings
      </router-link>
    </div>
  </aside>

  <!-- Dialogs (teleported outside the sidebar for proper z-index) -->
  <CreateServerDialog
    v-if="showCreateSpace"
    @create="handleCreateSpace"
    @close="showCreateSpace = false"
  />
  <JoinServerDialog
    v-if="showJoinSpace"
    @join="handleJoinSpace"
    @close="showJoinSpace = false"
  />

  <!-- Invite dialog -->
  <div v-if="inviteDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="inviteDialog = null">
    <div class="w-full max-w-md rounded-lg bg-bg-secondary p-6">
      <h2 class="mb-4 text-xl font-bold">Invite to Space</h2>
      <p class="mb-2 text-sm text-text-secondary">Share this invite code:</p>
      <div class="flex items-center gap-2">
        <input :value="inviteDialog.code" readonly class="flex-1 rounded border border-bg-tertiary bg-bg-primary px-3 py-2 font-mono text-text-primary" />
        <button @click="copyInviteCode" class="rounded bg-accent px-3 py-2 text-sm text-white hover:bg-accent-hover">Copy</button>
      </div>
      <button v-if="inviteDialog.isOwner" @click="handleRegenerateInvite" class="mt-2 text-sm text-text-muted hover:text-text-primary">Regenerate code</button>
      <div class="mt-4 flex justify-end">
        <button @click="inviteDialog = null" class="rounded px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Close</button>
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

  <!-- Close add menu on outside click -->
  <div v-if="showAddMenu" class="fixed inset-0 z-30" @click="showAddMenu = false" />
</template>
