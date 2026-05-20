<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { backend } from '@/lib/backend'
import { usePresenceStore } from '@/stores/presence'
import UserAvatar from '@/components/user/UserAvatar.vue'
import UserIntegrationSection from '@/components/integrations/UserIntegrationSection.vue'
import type { Profile } from '@/lib/types'

const props = defineProps<{
  userId: string
}>()
const emit = defineEmits<{ close: [] }>()

const router = useRouter()
const presenceStore = usePresenceStore()
const profile = ref<Profile | null>(null)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    profile.value = await backend.profiles.get(props.userId)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load profile'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="emit('close')">
    <div class="absolute inset-0 bg-black/60" @click="emit('close')" />
    <div class="relative z-10 w-full max-w-sm rounded-xl bg-bg-secondary shadow-xl overflow-hidden">

      <!-- Loading -->
      <div v-if="loading" class="p-8 text-center">
        <div class="mx-auto h-16 w-16 animate-pulse rounded bg-bg-tertiary" />
        <div class="mt-4 h-4 w-32 mx-auto animate-pulse rounded bg-bg-tertiary" />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="p-8 text-center text-red-400 text-sm">{{ error }}</div>

      <!-- Profile content -->
      <template v-else-if="profile">
        <!-- Banner -->
        <div class="h-20 bg-gradient-to-br from-accent/40 to-bg-tertiary" />

        <div class="px-4 pb-4">
          <!-- Avatar (overlapping banner) -->
          <div class="-mt-8 mb-3 flex items-end justify-between">
            <UserAvatar
              :src="profile.avatar_url"
              :alt="profile.display_name"
              :status="presenceStore.getStatus(userId, profile.status)"
              size="lg"
              class="ring-4 ring-bg-secondary"
            />
            <button @click="emit('close')" class="mb-1 rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="space-y-1">
            <h2 class="text-lg font-bold leading-tight">{{ profile.display_name }}</h2>
            <div class="flex items-center gap-2">
              <p class="text-sm text-text-muted">@{{ profile.username }}</p>
              <span class="flex items-center gap-0.5 rounded bg-violet-500/15 px-1.5 py-0.5 text-xs font-medium text-violet-400">
                <svg class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                {{ profile.meta_points ?? 0 }}
              </span>
            </div>
          </div>

          <div v-if="profile.status_text" class="mt-2 text-sm text-text-secondary italic">
            "{{ profile.status_text }}"
          </div>

          <div v-if="profile.bio" class="mt-3 border-t border-bg-tertiary pt-3 text-sm text-text-secondary">
            {{ profile.bio }}
          </div>

          <div v-if="profile.pronouns || profile.website || profile.location" class="mt-2 space-y-1">
            <p v-if="profile.pronouns" class="text-xs text-text-muted">{{ profile.pronouns }}</p>
            <a v-if="profile.website" :href="profile.website" target="_blank" rel="noopener noreferrer" class="block text-xs text-accent hover:underline truncate">{{ profile.website }}</a>
            <p v-if="profile.location" class="text-xs text-text-secondary">📍 {{ profile.location }}</p>
          </div>

          <!-- Integration data -->
          <UserIntegrationSection :user-id="userId" />

          <div class="mt-3 flex items-center justify-between border-t border-bg-tertiary pt-3">
            <span class="text-xs text-text-muted">Member since {{ new Date(profile.created_at).toLocaleDateString() }}</span>
            <button
              @click="router.push(`/u/${profile.username}`); emit('close')"
              class="rounded px-2 py-1 text-xs text-accent hover:underline"
            >View page →</button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
