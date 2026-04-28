<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useAuthStore } from '@/stores/auth'
import { useProfile } from '@/composables/useProfile'
import { useIntegrations } from '@/composables/useIntegrations'
import { useUserIntegrations } from '@/composables/useUserIntegrations'
import { useToastStore } from '@/stores/toast'
import UserAvatar from '@/components/user/UserAvatar.vue'
import IntegrationConnectDialog from '@/components/integrations/IntegrationConnectDialog.vue'
import FieldVisibilityControl from '@/components/integrations/FieldVisibilityControl.vue'
import type { Integration, IntegrationFieldSchema, FieldVisibility } from '@/lib/types'

const router = useRouter()
const { logout, logoutGlobal } = useAuth()
const { profile, loading, error, fetchProfile, updateProfile, uploadAvatar } = useProfile()
const toastStore = useToastStore()

const authStore = useAuthStore()
const { integrations: allIntegrations, fetchIntegrations, listFieldSchemas } = useIntegrations()
const { myIntegrations, fetchMyIntegrations, connect, disconnect, syncData, setFieldVisibility, isConnected, getVisibility } = useUserIntegrations()

const syncing = ref<Record<string, boolean>>({})

const connectDialog = ref<Integration | null>(null)
const fieldSchemaCache = ref<Record<string, IntegrationFieldSchema[]>>({})

const username = ref('')
const displayName = ref('')
const bio = ref('')
const statusText = ref('')
const pronouns = ref('')
const website = ref('')
const location = ref('')
const saving = ref(false)

onMounted(async () => {
  await fetchProfile()
  // Load integrations data
  await fetchIntegrations()
  if (authStore.user) {
    await fetchMyIntegrations(authStore.user.id)
    // Preload field schemas for connected integrations
    for (const ui of myIntegrations.value) {
      fieldSchemaCache.value[ui.integration_id] = await listFieldSchemas(ui.integration_id)
    }
  }
  if (profile.value) {
    username.value = profile.value.username
    displayName.value = profile.value.display_name
    bio.value = profile.value.bio
    statusText.value = profile.value.status_text
    pronouns.value = profile.value.pronouns ?? ''
    website.value = profile.value.website ?? ''
    location.value = profile.value.location ?? ''
  }
})

async function handleSave() {
  saving.value = true
  await updateProfile({
    username: username.value,
    display_name: displayName.value,
    bio: bio.value,
    status_text: statusText.value,
    pronouns: pronouns.value,
    website: website.value,
    location: location.value,
  })
  if (!error.value) {
    toastStore.show('Profile updated', 'success')
  }
  saving.value = false
}

async function handleAvatarUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const url = await uploadAvatar(file)
  if (url) {
    await updateProfile({ avatar_url: url })
  }
}

async function handleLogout() {
  await logout()
  router.push('/login')
}

async function handleLogoutGlobal() {
  await logoutGlobal()
  router.push('/login')
}

async function handleConnect(token?: string) {
  if (!authStore.user || !connectDialog.value) return
  try {
    await connect(authStore.user.id, connectDialog.value.id, token)
    fieldSchemaCache.value[connectDialog.value.id] = await listFieldSchemas(connectDialog.value.id)
    toastStore.show(`Connected to ${connectDialog.value.name}`, 'success')
  } catch (e: unknown) {
    toastStore.show(e instanceof Error ? e.message : 'Failed to connect', 'error')
  }
  connectDialog.value = null
}

async function handleDisconnect(integrationId: string) {
  if (!authStore.user) return
  try {
    await disconnect(authStore.user.id, integrationId)
    toastStore.show('Disconnected', 'success')
  } catch (e: unknown) {
    toastStore.show(e instanceof Error ? e.message : 'Failed to disconnect', 'error')
  }
}

function getMyIntegration(integrationId: string) {
  return myIntegrations.value.find((ui) => ui.integration_id === integrationId)
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

async function handleSync(integrationId: string) {
  const ui = getMyIntegration(integrationId)
  if (!ui) return
  syncing.value[integrationId] = true
  try {
    await syncData(ui.id)
    if (authStore.user) await fetchMyIntegrations(authStore.user.id)
    toastStore.show('Data synced', 'success')
  } catch (e: unknown) {
    toastStore.show(e instanceof Error ? e.message : 'Sync failed', 'error')
  } finally {
    syncing.value[integrationId] = false
  }
}

async function handleVisibilityChange(fieldSchemaId: string, visibility: FieldVisibility) {
  if (!authStore.user) return
  try {
    await setFieldVisibility(authStore.user.id, fieldSchemaId, visibility)
  } catch (e: unknown) {
    toastStore.show(e instanceof Error ? e.message : 'Failed to update visibility', 'error')
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4 py-8">
    <div class="w-full max-w-2xl rounded-lg bg-bg-secondary p-8">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl font-bold">Profile Settings</h1>
        <div class="flex items-center gap-3">
          <button
            v-if="profile"
            @click="router.push(`/u/${profile.username}`)"
            class="text-sm text-accent hover:underline"
          >My page</button>
          <button
            @click="router.push('/channels/@me')"
            class="text-sm text-text-secondary hover:text-text-primary"
          >Back to chat</button>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="loading && !profile" class="py-8 text-center text-text-secondary">
        Loading profile...
      </div>

      <!-- Profile form -->
      <template v-else-if="profile">
        <!-- Error display -->
        <div v-if="error" class="mb-4 rounded bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {{ error }}
        </div>

        <!-- Avatar section -->
        <div class="mb-6 flex items-center gap-4">
          <UserAvatar
            :src="profile.avatar_url"
            :alt="profile.display_name"
            :status="profile.status"
            size="lg"
          />
          <div class="flex flex-col gap-2">
            <span class="flex w-fit items-center gap-1 rounded bg-violet-500/15 px-2 py-1 text-sm font-medium text-violet-400">
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              {{ profile.meta_points ?? 0 }} meta
            </span>
            <label
              class="cursor-pointer rounded bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary hover:bg-accent"
            >
              Change avatar
              <input
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleAvatarUpload"
              />
            </label>
          </div>
        </div>

        <form @submit.prevent="handleSave" class="space-y-4">
          <!-- Username -->
          <div>
            <label for="username" class="mb-1 block text-sm text-text-secondary">Username</label>
            <input
              id="username"
              v-model="username"
              type="text"
              required
              maxlength="32"
              class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
            />
          </div>

          <!-- Display Name -->
          <div>
            <label for="display-name" class="mb-1 block text-sm text-text-secondary">Display Name</label>
            <input
              id="display-name"
              v-model="displayName"
              type="text"
              required
              maxlength="48"
              class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
            />
          </div>

          <!-- Bio -->
          <div>
            <label for="bio" class="mb-1 block text-sm text-text-secondary">Bio</label>
            <textarea
              id="bio"
              v-model="bio"
              maxlength="500"
              rows="3"
              class="w-full resize-none rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
              placeholder="Tell us about yourself"
            />
            <p class="mt-1 text-xs text-text-muted">{{ bio.length }}/500</p>
          </div>

          <!-- Status Text -->
          <div>
            <label for="status-text" class="mb-1 block text-sm text-text-secondary">Status</label>
            <input
              id="status-text"
              v-model="statusText"
              type="text"
              maxlength="128"
              class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
              placeholder="What are you up to?"
            />
          </div>

          <!-- Rich profile fields (PTSPH-167) -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label for="pronouns" class="mb-1 block text-sm text-text-secondary">Pronouns</label>
              <input
                id="pronouns"
                v-model="pronouns"
                type="text"
                maxlength="32"
                class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
                placeholder="they/them"
              />
            </div>
            <div>
              <label for="location" class="mb-1 block text-sm text-text-secondary">Location</label>
              <input
                id="location"
                v-model="location"
                type="text"
                maxlength="64"
                class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
                placeholder="City, Country"
              />
            </div>
            <div>
              <label for="website" class="mb-1 block text-sm text-text-secondary">Website</label>
              <input
                id="website"
                v-model="website"
                type="url"
                maxlength="256"
                class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
                placeholder="https://example.com"
              />
            </div>
          </div>

          <div class="flex items-center justify-between pt-2">
            <button
              type="submit"
              :disabled="saving"
              class="rounded bg-accent px-6 py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {{ saving ? 'Saving...' : 'Save changes' }}
            </button>
            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="handleLogoutGlobal"
                class="rounded border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
                title="Sign out of all devices and sessions"
              >
                Sign out everywhere
              </button>
              <button
                type="button"
                @click="handleLogout"
                class="rounded border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
              >
                Log out
              </button>
            </div>
          </div>
        </form>

        <!-- Connected Integrations section -->
        <div v-if="allIntegrations.filter((i) => i.enabled).length > 0" class="mt-8 border-t border-bg-tertiary pt-6">
          <h2 class="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">Connected Integrations</h2>

          <div class="space-y-3">
            <div
              v-for="integration in allIntegrations.filter((i) => i.enabled)"
              :key="integration.id"
              class="rounded-lg bg-bg-primary p-4"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent/15">
                    <img v-if="integration.icon_url" :src="integration.icon_url" :alt="integration.name" class="h-5 w-5 rounded" />
                    <svg v-else class="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-text-primary truncate">{{ integration.name }}</p>
                    <p v-if="integration.description" class="text-xs text-text-muted truncate">{{ integration.description }}</p>
                    <p v-if="isConnected(integration.id)" class="text-[10px] text-text-muted">Synced: {{ relativeTime(getMyIntegration(integration.id)?.synced_at ?? null) }}</p>
                  </div>
                </div>
                <div v-if="isConnected(integration.id)" class="flex flex-shrink-0 items-center gap-2">
                  <button
                    @click="handleSync(integration.id)"
                    :disabled="syncing[integration.id]"
                    class="rounded-md border border-bg-tertiary px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover transition-colors disabled:opacity-50"
                  >{{ syncing[integration.id] ? 'Syncing...' : 'Sync' }}</button>
                  <button
                    @click="handleDisconnect(integration.id)"
                    class="rounded-md border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                  >Disconnect</button>
                </div>
                <button
                  v-else
                  @click="connectDialog = integration"
                  class="flex-shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors"
                >Connect</button>
              </div>

              <!-- Field visibility controls (only for connected integrations) -->
              <div v-if="isConnected(integration.id) && fieldSchemaCache[integration.id]?.length" class="mt-3 border-t border-bg-tertiary pt-3">
                <p class="mb-2 text-xs text-text-muted">Choose which data to share on your profile:</p>
                <FieldVisibilityControl
                  v-for="schema in fieldSchemaCache[integration.id]"
                  :key="schema.id"
                  :label="schema.label"
                  :field-key="schema.field_key"
                  :visibility="getVisibility(schema.id, schema.default_visibility)"
                  @change="handleVisibilityChange(schema.id, $event)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Connect dialog -->
        <IntegrationConnectDialog
          v-if="connectDialog"
          :integration="connectDialog"
          @connect="handleConnect"
          @cancel="connectDialog = null"
        />
      </template>

      <!-- No profile / error fallback -->
      <div v-else class="py-8 text-center text-text-secondary">
        Unable to load profile. Make sure you're connected to Supabase.
      </div>
    </div>
  </div>
</template>
