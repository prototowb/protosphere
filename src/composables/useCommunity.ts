import { backend } from '@/lib/backend'
import { useCommunityStore } from '@/stores/community'
import type { CommunitySettings } from '@/lib/types'

export function useCommunity() {
  const store = useCommunityStore()

  async function fetchCommunity(): Promise<CommunitySettings> {
    store.loading = true
    try {
      const settings = await backend.community.get()
      store.setSettings(settings)
      return settings
    } finally {
      store.loading = false
    }
  }

  async function updateCommunity(
    updates: Parameters<typeof backend.community.update>[0],
  ): Promise<CommunitySettings> {
    const settings = await backend.community.update(updates)
    store.setSettings(settings)
    return settings
  }

  return { fetchCommunity, updateCommunity }
}
