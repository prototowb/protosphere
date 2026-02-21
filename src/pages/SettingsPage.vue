<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useProfile } from '@/composables/useProfile'
import { useToastStore } from '@/stores/toast'
import UserAvatar from '@/components/user/UserAvatar.vue'

const router = useRouter()
const { logout } = useAuth()
const { profile, loading, error, fetchProfile, updateProfile, uploadAvatar } = useProfile()
const toastStore = useToastStore()

const displayName = ref('')
const bio = ref('')
const statusText = ref('')
const saving = ref(false)

onMounted(async () => {
  await fetchProfile()
  if (profile.value) {
    displayName.value = profile.value.display_name
    bio.value = profile.value.bio
    statusText.value = profile.value.status_text
  }
})

async function handleSave() {
  saving.value = true
  await updateProfile({
    display_name: displayName.value,
    bio: bio.value,
    status_text: statusText.value,
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
          <!-- Username (read-only) -->
          <div>
            <label class="mb-1 block text-sm text-text-secondary">Username</label>
            <input
              :value="profile.username"
              disabled
              class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-muted opacity-60"
            />
            <p class="mt-1 text-xs text-text-muted">Username cannot be changed yet</p>
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

          <div class="flex items-center justify-between pt-2">
            <button
              type="submit"
              :disabled="saving"
              class="rounded bg-accent px-6 py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {{ saving ? 'Saving...' : 'Save changes' }}
            </button>
            <button
              type="button"
              @click="handleLogout"
              class="rounded border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
            >
              Log out
            </button>
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
