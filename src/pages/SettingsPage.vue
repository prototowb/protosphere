<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useProfile } from '@/composables/useProfile'
import { useToastStore } from '@/stores/toast'
import UserAvatar from '@/components/user/UserAvatar.vue'

const router = useRouter()
const { logout, logoutGlobal } = useAuth()
const { profile, loading, error, fetchProfile, updateProfile, uploadAvatar } = useProfile()
const toastStore = useToastStore()

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
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4 py-8">
    <div class="w-full max-w-2xl rounded-lg bg-bg-secondary p-8">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl font-bold">Profile Settings</h1>
        <button
          @click="router.push('/channels/@me')"
          class="text-sm text-text-secondary hover:text-text-primary"
        >
          Back to chat
        </button>
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
          <div>
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
      </template>

      <!-- No profile / error fallback -->
      <div v-else class="py-8 text-center text-text-secondary">
        Unable to load profile. Make sure you're connected to Supabase.
      </div>
    </div>
  </div>
</template>
