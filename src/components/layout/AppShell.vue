<script setup lang="ts">
import { ref, onMounted, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useProfile } from '@/composables/useProfile'
import { useServers } from '@/composables/useServers'
import { usePresence } from '@/composables/usePresence'
import { useMentionsStore } from '@/stores/mentions'
import { useDmUnread } from '@/composables/useDmUnread'
import { useContextMenuStore } from '@/stores/contextMenu'
import { useToastStore } from '@/stores/toast'
import { userBarContextItems } from '@/lib/contextMenuItems'
import UserAvatar from '@/components/user/UserAvatar.vue'
import CommunitySidebar from '@/components/layout/CommunitySidebar.vue'
import type { UserStatus } from '@/lib/types'

const router = useRouter()
const ui = useUiStore()
const authStore = useAuthStore()
const { profile, fetchProfile } = useProfile()
const { fetchServers } = useServers()
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
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <!-- Community Sidebar (replaces old narrow icon sidebar) -->
    <CommunitySidebar v-if="ui.serverSidebarOpen" />

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
  </div>
</template>
