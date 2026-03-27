<script setup lang="ts">
import { ref } from 'vue'
import { backend } from '@/lib/backend'
import UserAvatar from '@/components/user/UserAvatar.vue'
import type { Profile } from '@/lib/types'

const props = defineProps<{
  postId: string
  invitedBy: string
  existingUserIds: string[]
}>()

const emit = defineEmits<{
  added: [userId: string]
  close: []
}>()

const query = ref('')
const results = ref<Profile[]>([])
const adding = ref<string | null>(null)
const searching = ref(false)

async function search() {
  if (!query.value.trim()) { results.value = []; return }
  searching.value = true
  try {
    const all = await backend.profiles.search(query.value.trim(), props.invitedBy)
    results.value = all.filter((p) => !props.existingUserIds.includes(p.id))
  } finally {
    searching.value = false
  }
}

async function invite(profile: Profile) {
  adding.value = profile.id
  try {
    await backend.forum.addCollaborator(props.postId, profile.id, props.invitedBy)
    emit('added', profile.id)
  } finally {
    adding.value = null
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="emit('close')">
    <div class="w-full max-w-sm rounded-xl bg-bg-secondary p-6 shadow-xl">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-base font-semibold text-text-primary">Invite collaborator</h2>
        <button @click="emit('close')" class="text-text-muted hover:text-text-primary">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="flex gap-2">
        <input
          v-model="query"
          @input="search"
          placeholder="Search by username…"
          class="flex-1 rounded-lg bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none ring-1 ring-bg-tertiary focus:ring-accent"
        />
      </div>

      <div class="mt-3 max-h-60 overflow-y-auto space-y-1">
        <div v-if="searching" class="py-4 text-center text-sm text-text-muted">Searching…</div>
        <div v-else-if="!results.length && query" class="py-4 text-center text-sm text-text-muted">No results</div>
        <button
          v-for="profile in results"
          :key="profile.id"
          @click="invite(profile)"
          :disabled="adding === profile.id"
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-bg-hover disabled:opacity-50"
        >
          <UserAvatar :src="profile.avatar_url" :alt="profile.display_name" size="sm" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-text-primary">{{ profile.display_name }}</p>
            <p class="truncate text-xs text-text-muted">@{{ profile.username }}</p>
          </div>
          <span class="text-xs text-accent">{{ adding === profile.id ? 'Adding…' : 'Invite' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
