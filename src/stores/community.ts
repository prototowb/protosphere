import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CommunitySettings } from '@/lib/types'

export const useCommunityStore = defineStore('community', () => {
  const settings = ref<CommunitySettings | null>(null)
  const loading = ref(false)

  function setSettings(s: CommunitySettings) {
    settings.value = s
  }

  return { settings, loading, setSettings }
})
