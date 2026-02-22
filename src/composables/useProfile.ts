import { ref } from 'vue'
import { backend } from '@/lib/backend'
import { useAuthStore } from '@/stores/auth'
import type { Profile } from '@/lib/types'

// Shared across all useProfile() call sites — any update is immediately
// visible in AppShell's user bar, SettingsPage, etc.
const profile = ref<Profile | null>(null)

export function useProfile() {
  const loading = ref(false)
  const error = ref('')

  async function fetchProfile(userId?: string) {
    const authStore = useAuthStore()
    const id = userId ?? authStore.user?.id
    if (!id) return

    loading.value = true
    error.value = ''
    try {
      profile.value = await backend.profiles.get(id)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch profile'
    } finally {
      loading.value = false
    }
  }

  async function updateProfile(updates: Partial<Pick<Profile, 'username' | 'display_name' | 'bio' | 'status_text' | 'avatar_url'>>) {
    const authStore = useAuthStore()
    if (!authStore.user?.id) return

    loading.value = true
    error.value = ''
    try {
      profile.value = await backend.profiles.update(authStore.user.id, updates)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to update profile'
    } finally {
      loading.value = false
    }
  }

  async function uploadAvatar(file: File): Promise<string | null> {
    const authStore = useAuthStore()
    if (!authStore.user?.id) return null

    error.value = ''
    try {
      return await backend.profiles.uploadAvatar(authStore.user.id, file)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to upload avatar'
      return null
    }
  }

  return {
    profile,
    loading,
    error,
    fetchProfile,
    updateProfile,
    uploadAvatar,
  }
}
