<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { backend } from '@/lib/backend'
import { useServersStore } from '@/stores/servers'
import { usePresenceStore } from '@/stores/presence'
import UserAvatar from '@/components/user/UserAvatar.vue'
import type { Profile, Member } from '@/lib/types'

const serversStore = useServersStore()
const presenceStore = usePresenceStore()

const allMembers = ref<(Member & { profile: Profile })[]>([])
const searchQuery = ref('')
const loading = ref(true)

const filteredMembers = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return allMembers.value
  return allMembers.value.filter(
    (m) =>
      m.profile.display_name.toLowerCase().includes(q) ||
      m.profile.username.toLowerCase().includes(q),
  )
})

async function loadMembers() {
  loading.value = true
  const allServerMembers: Map<string, Member & { profile: Profile }> = new Map()
  for (const server of serversStore.servers) {
    try {
      const members = await backend.members.list(server.id)
      for (const m of members) {
        if (!allServerMembers.has(m.user_id)) {
          allServerMembers.set(m.user_id, m)
        }
      }
    } catch { /* skip */ }
  }
  allMembers.value = [...allServerMembers.values()].sort((a, b) =>
    a.profile.display_name.localeCompare(b.profile.display_name),
  )
  loading.value = false
}

onMounted(loadMembers)
</script>

<template>
  <div class="mx-auto max-w-3xl p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Community Members</h1>
      <p class="mt-1 text-text-secondary">{{ allMembers.length }} members total</p>
    </div>

    <div class="mb-4">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search members..."
        class="w-full rounded border border-bg-tertiary bg-bg-secondary px-3 py-2 text-text-primary outline-none focus:border-accent"
      />
    </div>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 8" :key="i" class="h-14 animate-pulse rounded-lg bg-bg-secondary" />
    </div>

    <div v-else-if="filteredMembers.length === 0" class="py-8 text-center text-text-muted">
      No members found.
    </div>

    <div v-else class="space-y-1">
      <div
        v-for="member in filteredMembers"
        :key="member.user_id"
        class="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-bg-secondary transition-colors"
      >
        <UserAvatar
          :src="member.profile.avatar_url"
          :alt="member.profile.display_name"
          :status="presenceStore.getStatus(member.user_id, member.profile.status)"
          size="sm"
        />
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium">{{ member.profile.display_name }}</p>
          <p class="truncate text-xs text-text-muted">@{{ member.profile.username }}</p>
        </div>
        <span class="flex-shrink-0 rounded px-2 py-0.5 text-xs bg-bg-tertiary text-text-muted capitalize">
          {{ member.role }}
        </span>
      </div>
    </div>
  </div>
</template>
