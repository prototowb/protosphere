<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { backend } from '@/lib/backend'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { usePresenceStore } from '@/stores/presence'
import UserAvatar from '@/components/user/UserAvatar.vue'
import BlockRenderer from '@/components/editor/BlockRenderer.vue'
import BlockEditor from '@/components/editor/BlockEditor.vue'
import UserIntegrationSection from '@/components/integrations/UserIntegrationSection.vue'
import type { Profile, PageContent } from '@/lib/types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const toastStore = useToastStore()
const presenceStore = usePresenceStore()

const profile = ref<Profile | null>(null)
const loading = ref(true)
const editing = ref(false)
const saving = ref(false)
const draft = ref<PageContent>({ blocks: [], customCss: '' })

const isOwn = computed(() => !!authStore.user?.id && authStore.user.id === profile.value?.id)
const hasPage = computed(() => !!profile.value?.profile_page?.blocks?.length)

onMounted(async () => {
  const username = route.params.username as string
  try {
    profile.value = await backend.profiles.getByUsername(username)
    draft.value = profile.value.profile_page ?? { blocks: [], customCss: '' }
  } catch {
    router.push('/404')
  } finally {
    loading.value = false
  }
})

async function save() {
  if (!authStore.user?.id) return
  saving.value = true
  try {
    const updated = await backend.profiles.updatePage(authStore.user.id, draft.value)
    profile.value = updated
    editing.value = false
    toastStore.show('Page saved', 'success')
  } catch {
    toastStore.show('Failed to save page', 'error')
  } finally {
    saving.value = false
  }
}

function cancelEdit() {
  draft.value = profile.value?.profile_page ?? { blocks: [], customCss: '' }
  editing.value = false
}
</script>

<template>
  <div class="min-h-screen bg-bg-primary">

    <!-- Loading -->
    <div v-if="loading" class="flex h-64 items-center justify-center">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>

    <template v-else-if="profile">
      <!-- Profile header -->
      <div class="border-b border-bg-tertiary bg-bg-secondary">
        <div class="mx-auto max-w-4xl px-6 py-6">
          <div class="flex items-end gap-5">
            <UserAvatar
              :src="profile.avatar_url"
              :alt="profile.display_name"
              :status="presenceStore.getStatus(profile.id, profile.status)"
              size="lg"
              class="flex-shrink-0"
            />
            <div class="min-w-0 flex-1 pb-1">
              <h1 class="text-2xl font-bold text-text-primary">{{ profile.display_name }}</h1>
              <p class="text-sm text-text-muted">@{{ profile.username }}</p>
              <div class="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-muted">
                <span v-if="profile.pronouns">{{ profile.pronouns }}</span>
                <span v-if="profile.location">📍 {{ profile.location }}</span>
                <a v-if="profile.website" :href="profile.website" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline truncate max-w-xs">{{ profile.website }}</a>
                <span class="flex items-center gap-0.5 rounded bg-violet-500/15 px-1.5 py-0.5 font-medium text-violet-400">
                  <svg class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  {{ profile.meta_points ?? 0 }}
                </span>
              </div>
              <p v-if="profile.bio" class="mt-2 text-sm text-text-secondary">{{ profile.bio }}</p>
            </div>

            <!-- Owner controls -->
            <div v-if="isOwn" class="flex flex-shrink-0 items-center gap-2 pb-1">
              <template v-if="editing">
                <button @click="cancelEdit" class="rounded px-3 py-1.5 text-sm text-text-muted hover:text-text-primary">Cancel</button>
                <button @click="save" :disabled="saving" class="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50">
                  {{ saving ? 'Saving…' : 'Save page' }}
                </button>
              </template>
              <button v-else @click="editing = true" class="rounded bg-bg-tertiary px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary">
                {{ hasPage ? 'Edit page' : 'Create page' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Integration data -->
      <div class="mx-auto max-w-4xl px-6 pt-4">
        <UserIntegrationSection :user-id="profile.id" />
      </div>

      <!-- Page content -->
      <div class="mx-auto max-w-4xl px-6 py-8">

        <!-- Editor mode -->
        <div v-if="isOwn && editing" class="h-[calc(100vh-220px)] rounded-lg border border-bg-tertiary overflow-hidden">
          <BlockEditor v-model="draft" />
        </div>

        <!-- Render mode -->
        <BlockRenderer v-else-if="hasPage" :content="profile.profile_page!" />

        <!-- Empty state -->
        <div v-else class="py-16 text-center text-text-muted">
          <svg class="mx-auto mb-3 h-10 w-10 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
          </svg>
          <p class="text-sm">{{ isOwn ? 'You haven\'t created a page yet.' : 'This user hasn\'t created a page yet.' }}</p>
          <button v-if="isOwn" @click="editing = true" class="mt-3 rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
            Create your page
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
